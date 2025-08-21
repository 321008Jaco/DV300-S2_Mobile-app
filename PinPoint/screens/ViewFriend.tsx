import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Image, TouchableOpacity, ScrollView } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { auth, db } from "../services/firebaseConfig";
import { doc, getDoc, onSnapshot, collection, query, where, addDoc, updateDoc, deleteDoc, serverTimestamp, getDocs, setDoc } from "firebase/firestore";

type PublicProfile = {
  userName?: string;
  displayName?: string;
  photoURL?: string | null;
  bio?: string;
  updatedAt?: any;
};

export default function ViewFriends() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const me = auth.currentUser?.uid || "";
  const uid: string = route.params?.uid || "";

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PublicProfile | null>(null);

  const [isFriend, setIsFriend] = useState(false);
  const [isCloseFriend, setIsCloseFriend] = useState(false);
  const [friendSince, setFriendSince] = useState<Date | null>(null);

  const [incomingReqId, setIncomingReqId] = useState<string | null>(null);
  const [outgoingReqId, setOutgoingReqId] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);

  const [publicCount, setPublicCount] = useState<number | null>(null);
  const [closeVisibleCount, setCloseVisibleCount] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "publicProfiles", uid));
        if (mounted) setProfile(snap.exists() ? (snap.data() as PublicProfile) : null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [uid]);

  useEffect(() => {
    if (!me || !uid) return;
    const edgeRef = doc(db, "users", me, "friends", uid);
    const unsubEdge = onSnapshot(edgeRef, (s) => {
      const ex = s.exists();
      setIsFriend(ex);
      if (ex) {
        const d = s.data() as any;
        setIsCloseFriend(!!d.isCloseFriend);
        const ts = d.createdAt?.toDate?.() || null;
        setFriendSince(ts);
      } else {
        setIsCloseFriend(false);
        setFriendSince(null);
      }
    });

    const qIn = query(collection(db, "friendRequests"), where("fromUid", "==", uid), where("toUid", "==", me), where("status", "==", "pending"));
    const qOut = query(collection(db, "friendRequests"), where("fromUid", "==", me), where("toUid", "==", uid), where("status", "==", "pending"));
    const unsubIn = onSnapshot(qIn, (snap) => setIncomingReqId(snap.empty ? null : snap.docs[0].id));
    const unsubOut = onSnapshot(qOut, (snap) => setOutgoingReqId(snap.empty ? null : snap.docs[0].id));

    return () => {
      unsubEdge();
      unsubIn();
      unsubOut();
    };
  }, [me, uid]);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const qPub = query(collection(db, "pins"), where("userId", "==", uid), where("isPublic", "==", true));
        const sPub = await getDocs(qPub);
        setPublicCount(sPub.size);
      } catch {
        setPublicCount(0);
      }
      try {
        const qClose = query(collection(db, "pins"), where("userId", "==", uid), where("visibility", "==", "close"));
        const sClose = await getDocs(qClose);
        setCloseVisibleCount(sClose.size);
      } catch {
        setCloseVisibleCount(0);
      }
    })();
  }, [uid]);

  const sendRequest = async () => {
    if (!me) return;
    try {
      setBusy(true);
      await addDoc(collection(db, "friendRequests"), { fromUid: me, toUid: uid, status: "pending", createdAt: serverTimestamp() });
    } finally {
      setBusy(false);
    }
  };

  const acceptRequest = async () => {
    if (!incomingReqId) return;
    try {
      setBusy(true);
      await updateDoc(doc(db, "friendRequests", incomingReqId), { status: "accepted" });
      const p = await getDoc(doc(db, "publicProfiles", uid));
      const pd = p.data() as any | undefined;
      await setDoc(doc(db, "users", me, "friends", uid), {
        friendUid: uid,
        isCloseFriend: false,
        userName: pd?.userName || null,
        displayName: pd?.displayName || null,
        photoURL: pd?.photoURL || null,
        createdAt: serverTimestamp(),
      });
    } finally {
      setBusy(false);
    }
  };

  const rejectRequest = async () => {
    if (!incomingReqId) return;
    try {
      setBusy(true);
      await updateDoc(doc(db, "friendRequests", incomingReqId), { status: "rejected" });
    } finally {
      setBusy(false);
    }
  };

  const cancelRequest = async () => {
    if (!outgoingReqId) return;
    try {
      setBusy(true);
      await updateDoc(doc(db, "friendRequests", outgoingReqId), { status: "cancelled" });
    } finally {
      setBusy(false);
    }
  };

  const toggleClose = async () => {
    if (!me) return;
    const next = !isCloseFriend;
    try {
      setBusy(true);
      await setDoc(doc(db, "users", me, "friends", uid), { isCloseFriend: next, updatedAt: new Date() }, { merge: true });
      await addDoc(collection(db, "closeFriendSignals"), { fromUid: me, toUid: uid, set: next, createdAt: serverTimestamp() });
    } finally {
      setBusy(false);
    }
  };

  const unfriend = async () => {
    if (!me) return;
    try {
      setBusy(true);
      await deleteDoc(doc(db, "users", me, "friends", uid));
      await addDoc(collection(db, "unfriendSignals"), { fromUid: me, toUid: uid, createdAt: serverTimestamp() });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FD5308" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Profile not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const display = profile.displayName || "";
  const uname = profile.userName ? `@${profile.userName}` : "";
  const initial = (display || uname || "?").trim().charAt(0).toUpperCase();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarWrap}>
          {profile.photoURL ? (
            <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          )}
        </View>
        <Text style={styles.name}>{display}</Text>
        {!!uname && <Text style={styles.username}>{uname}</Text>}
        {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{publicCount ?? "—"}</Text>
          <Text style={styles.statLabel}>Public Pins</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{closeVisibleCount ?? "—"}</Text>
          <Text style={styles.statLabel}>Close Pins</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{isFriend ? "Yes" : "No"}</Text>
          <Text style={styles.statLabel}>Friend</Text>
        </View>
      </View>

      {friendSince && (
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Friends since {friendSince.toLocaleDateString()}</Text>
        </View>
      )}

      <View style={styles.actions}>
        {incomingReqId ? (
          <View style={styles.row}>
            <TouchableOpacity style={styles.primaryBtn} onPress={acceptRequest} disabled={busy}>
              <Text style={styles.primaryBtnText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dangerOutlineBtn} onPress={rejectRequest} disabled={busy}>
              <Text style={styles.dangerOutlineBtnText}>Reject</Text>
            </TouchableOpacity>
          </View>
        ) : outgoingReqId ? (
          <View style={styles.row}>
            <View style={styles.pendingPill}>
              <Text style={styles.pendingText}>Request Sent</Text>
            </View>
            <TouchableOpacity style={styles.dangerOutlineBtn} onPress={cancelRequest} disabled={busy}>
              <Text style={styles.dangerOutlineBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : isFriend ? (
          <View style={styles.row}>
            <TouchableOpacity style={isCloseFriend ? styles.neutralBtn : styles.secondaryBtn} onPress={toggleClose} disabled={busy}>
              <Text style={isCloseFriend ? styles.neutralBtnText : styles.secondaryBtnText}>{isCloseFriend ? "Remove Close Friend" : "Add Close Friend"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dangerBtn} onPress={unfriend} disabled={busy}>
              <Text style={styles.dangerBtnText}>Remove Friend</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.primaryBtn} onPress={sendRequest} disabled={busy}>
            <Text style={styles.primaryBtnText}>Add Friend</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  notFound: { fontSize: 16, color: "#333", marginBottom: 12 },
  backBtn: { backgroundColor: "#FD5308", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  backBtnText: { color: "#fff", fontWeight: "700" },
  container: { padding: 20, backgroundColor: "#fff" },
  header: { alignItems: "center", marginTop: 10, marginBottom: 16 },
  avatarWrap: { width: 128, height: 128, borderRadius: 64, borderWidth: 4, borderColor: "#FD5308", padding: 2 },
  avatar: { width: "100%", height: "100%", borderRadius: 64 },
  avatarPlaceholder: { width: "100%", height: "100%", borderRadius: 64, backgroundColor: "#ffe6da", alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 52, color: "#FD5308", fontWeight: "800" },
  name: { fontSize: 24, fontWeight: "800", marginTop: 12, color: "#111", textAlign: "center" },
  username: { fontSize: 14, color: "#FD5308", marginTop: 4 },
  bio: { fontSize: 15, color: "#444", lineHeight: 20, marginTop: 12, textAlign: "center", paddingHorizontal: 12 },
  statsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  statCard: { flex: 1, backgroundColor: "#fafafa", borderRadius: 12, paddingVertical: 14, marginHorizontal: 4, alignItems: "center" },
  statNum: { fontSize: 18, fontWeight: "800", color: "#111" },
  statLabel: { fontSize: 12, color: "#666", marginTop: 4 },
  metaRow: { alignItems: "center", marginTop: 12 },
  metaText: { color: "#666" },
  actions: { marginTop: 20 },
  row: { flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center" },
  primaryBtn: { backgroundColor: "#FD5308", paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontWeight: "800" },
  secondaryBtn: { backgroundColor: "#ffe6da", paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12 },
  secondaryBtnText: { color: "#FD5308", fontWeight: "800" },
  neutralBtn: { backgroundColor: "#9CA3AF", paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12 },
  neutralBtnText: { color: "#fff", fontWeight: "800" },
  dangerBtn: { backgroundColor: "#ef4444", paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12 },
  dangerBtnText: { color: "#fff", fontWeight: "800" },
  dangerOutlineBtn: { borderWidth: 2, borderColor: "#ef4444", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  dangerOutlineBtnText: { color: "#ef4444", fontWeight: "800" },
  pendingPill: { backgroundColor: "#fff3e6", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999 },
  pendingText: { color: "#d97706", fontWeight: "700" },
});
