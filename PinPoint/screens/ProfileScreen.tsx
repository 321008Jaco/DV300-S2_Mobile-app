import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, Alert, ActivityIndicator, ScrollView } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { auth, db, storage } from "../services/firebaseConfig";
import { doc, getDoc, runTransaction, setDoc, addDoc, collection, onSnapshot, query, where, updateDoc, deleteDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useNavigation } from "@react-navigation/native";

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const uid = auth.currentUser?.uid || null;

  const [displayName, setDisplayName] = useState("");
  const [userName, setUserName] = useState("");
  const [bio, setBio] = useState("");
  const [photoURL, setPhotoURL] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [friends, setFriends] = useState<any[]>([]);
  const [incoming, setIncoming] = useState<any[]>([]);
  const [outgoing, setOutgoing] = useState<any[]>([]);
  const [searchUsername, setSearchUsername] = useState("");
  const [sending, setSending] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(true);

  const [profiles, setProfiles] = useState<Record<string, { userName?: string; displayName?: string; photoURL?: string | null }>>({});

  useEffect(() => {
    const load = async () => {
      if (!uid) return;
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) {
          const d = snap.data() as any;
          setDisplayName(d.displayName || "");
          setUserName(d.userName || "");
          setBio(d.bio || "");
          setPhotoURL(d.photoURL || null);
        }
      } catch {
        Alert.alert("Error", "Failed to load profile.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [uid]);

  useEffect(() => {
    const syncPublic = async () => {
      if (!uid) return;
      await setDoc(
        doc(db, "publicProfiles", uid),
        {
          displayName: displayName || auth.currentUser?.email || "",
          userName: userName || "",
          photoURL: photoURL || null,
          updatedAt: new Date(),
        },
        { merge: true }
      );
    };
    if (!loading) syncPublic();
  }, [uid, loading, displayName, userName, photoURL]);

  useEffect(() => {
    if (!uid) return;

    const unsubFriends = onSnapshot(collection(db, "users", uid, "friends"), (snap) => {
      setFriends(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });

    const qIn = query(collection(db, "friendRequests"), where("toUid", "==", uid), where("status", "==", "pending"));
    const qOut = query(collection(db, "friendRequests"), where("fromUid", "==", uid), where("status", "==", "pending"));
    const unsubIn = onSnapshot(qIn, (snap) => {
      setIncoming(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setRequestsLoading(false);
    });
    const unsubOut = onSnapshot(qOut, (snap) => {
      setOutgoing(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setRequestsLoading(false);
    });

    const qAcceptedOut = query(collection(db, "friendRequests"), where("fromUid", "==", uid), where("status", "==", "accepted"));
    const unsubAccepted = onSnapshot(qAcceptedOut, async (snap) => {
      for (const d of snap.docs) {
        const other = (d.data() as any).toUid as string;
        const meEdgeRef = doc(db, "users", uid, "friends", other);
        const meEdgeSnap = await getDoc(meEdgeRef);
        if (!meEdgeSnap.exists()) {
          const p = await getDoc(doc(db, "publicProfiles", other));
          const pd = p.data() as any | undefined;
          await setDoc(meEdgeRef, {
            friendUid: other,
            isCloseFriend: false,
            userName: pd?.userName || null,
            displayName: pd?.displayName || null,
            photoURL: pd?.photoURL || null,
            createdAt: serverTimestamp(),
          });
        }
      }
    });

    const qSignals = query(collection(db, "unfriendSignals"), where("toUid", "==", uid));
    const unsubSignals = onSnapshot(qSignals, async (snap) => {
      for (const d of snap.docs) {
        const { fromUid } = d.data() as any;
        const myEdgeRef = doc(db, "users", uid, "friends", fromUid);
        const myEdgeSnap = await getDoc(myEdgeRef);
        if (myEdgeSnap.exists()) await deleteDoc(myEdgeRef);
        await deleteDoc(d.ref);
      }
    });

    const qClose = query(collection(db, "closeFriendSignals"), where("toUid", "==", uid));
    const unsubClose = onSnapshot(qClose, async (snap) => {
      for (const d of snap.docs) {
        const { fromUid, set } = d.data() as any;
        const ref = doc(db, "users", uid, "friends", fromUid);
        const ex = await getDoc(ref);
        if (ex.exists()) {
          await updateDoc(ref, { isCloseFriend: !!set, updatedAt: serverTimestamp() });
        } else {
          const p = await getDoc(doc(db, "publicProfiles", fromUid));
          const pd = p.data() as any | undefined;
          await setDoc(ref, {
            friendUid: fromUid,
            isCloseFriend: !!set,
            userName: pd?.userName || null,
            displayName: pd?.displayName || null,
            photoURL: pd?.photoURL || null,
            createdAt: serverTimestamp(),
          });
        }
        await deleteDoc(d.ref);
      }
    });

    return () => {
      unsubFriends();
      unsubIn();
      unsubOut();
      unsubAccepted();
      unsubSignals();
      unsubClose();
    };
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const ids = new Set<string>();
    friends.forEach((f) => ids.add(f.friendUid));
    incoming.forEach((r) => ids.add(r.fromUid));
    outgoing.forEach((r) => ids.add(r.toUid));
    const uids = Array.from(ids);
    if (uids.length === 0) {
      setProfiles({});
      return;
    }
    (async () => {
      const entries: [string, { userName?: string; displayName?: string; photoURL?: string | null }][] = await Promise.all(
        uids.map(async (fid) => {
          const pub = await getDoc(doc(db, "publicProfiles", fid));
          const pd = (pub.exists() ? (pub.data() as any) : {}) || {};
          let uname = pd.userName as string | undefined;
          if (!uname) {
            const qs = await getDocs(query(collection(db, "usernames"), where("uid", "==", fid)));
            if (!qs.empty) uname = qs.docs[0].id;
          }
          return [fid, { userName: uname, displayName: pd.displayName, photoURL: pd.photoURL || null }];
        })
      );
      const map: Record<string, { userName?: string; displayName?: string; photoURL?: string | null }> = {};
      for (const [k, v] of entries) map[k] = v;
      setProfiles(map);
    })();
  }, [uid, friends, incoming, outgoing]);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "Please allow photo library access.");
      return;
    }
    const mediaTypes = (ImagePicker as any).MediaType?.Images ?? ImagePicker.MediaTypeOptions.Images;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if ((result as any).canceled) return;
    const uri = (result as any).assets?.[0]?.uri as string | undefined;
    if (!uri || !uid) return;
    try {
      setUploading(true);
      const res = await fetch(uri);
      const blob = await res.blob();
      const objectRef = ref(storage, `profilePictures/${uid}/avatar.jpg`);
      await uploadBytes(objectRef, blob, { contentType: "image/jpeg" });
      const url = await getDownloadURL(objectRef);
      setPhotoURL(url);
      await setDoc(doc(db, "users", uid), { photoURL: url, updatedAt: new Date() }, { merge: true });
      await setDoc(doc(db, "publicProfiles", uid), { photoURL: url, updatedAt: new Date() }, { merge: true });
    } catch (e: any) {
      Alert.alert("Upload failed", e?.message || "Could not upload image.");
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    if (!uid) return;
    const newDisplayName = displayName.trim();
    const desiredUserName = userName.trim().toLowerCase();
    const newBio = bio.trim();

    try {
      setSaving(true);
      await runTransaction(db, async (tx) => {
        const userRef = doc(db, "users", uid);
        const userSnap = await tx.get(userRef);
        const currentUserName = userSnap.exists() ? (userSnap.data()?.userName || "") : "";

        if (desiredUserName && desiredUserName !== currentUserName) {
          const desiredRef = doc(db, "usernames", desiredUserName);
          const desiredSnap = await tx.get(desiredRef);
          if (desiredSnap.exists()) throw new Error("USERNAME_TAKEN");
          tx.set(desiredRef, { uid });
          if (currentUserName) tx.delete(doc(db, "usernames", currentUserName));
          tx.set(userRef, { userName: desiredUserName }, { merge: true });
        }

        tx.set(
          userRef,
          {
            displayName: newDisplayName,
            bio: newBio,
            photoURL: photoURL || null,
            email: auth.currentUser?.email || "",
            updatedAt: new Date(),
          },
          { merge: true }
        );
      });

      await setDoc(
        doc(db, "publicProfiles", uid),
        { displayName: newDisplayName || auth.currentUser?.email || "", userName: desiredUserName || "", photoURL: photoURL || null, updatedAt: new Date() },
        { merge: true }
      );

      Alert.alert("Saved", "Profile updated.");
    } catch (e: any) {
      if (e?.message === "USERNAME_TAKEN") {
        Alert.alert("Username taken", "Please choose another username.");
      } else {
        Alert.alert("Error", e?.message || "Could not save profile.");
      }
    } finally {
      setSaving(false);
    }
  };

  const sendFriendRequest = async () => {
    if (!uid) return;
    const uname = searchUsername.trim().toLowerCase();
    if (!uname) {
      Alert.alert("Enter a username", "Type the exact username to send a request.");
      return;
    }
    try {
      setSending(true);
      const unameRef = doc(db, "usernames", uname);
      const unameSnap = await getDoc(unameRef);
      if (!unameSnap.exists()) {
        Alert.alert("Not found", "No user with that username.");
        return;
      }
      const toUid = (unameSnap.data() as any).uid as string;
      if (toUid === uid) {
        Alert.alert("Invalid", "You cannot add yourself.");
        return;
      }

      const q1 = query(collection(db, "friendRequests"), where("fromUid", "==", uid), where("toUid", "==", toUid), where("status", "==", "pending"));
      const s1 = await getDocs(q1);
      const q2 = query(collection(db, "friendRequests"), where("fromUid", "==", toUid), where("toUid", "==", uid), where("status", "==", "pending"));
      const s2 = await getDocs(q2);
      if (!s1.empty || !s2.empty) {
        Alert.alert("Already pending", "There is already a pending request between you.");
        return;
      }

      const meFriendsDoc = await getDoc(doc(db, "users", uid, "friends", toUid));
      if (meFriendsDoc.exists()) {
        Alert.alert("Already friends", "You are already friends.");
        return;
      }

      await addDoc(collection(db, "friendRequests"), {
        fromUid: uid,
        toUid,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      Alert.alert("Sent", "Friend request sent.");
      setSearchUsername("");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not send request.");
    } finally {
      setSending(false);
    }
  };

  const acceptRequest = async (req: any) => {
    if (!uid) return;
    try {
      await updateDoc(doc(db, "friendRequests", req.id), { status: "accepted" });
      const other = req.fromUid as string;
      const p = await getDoc(doc(db, "publicProfiles", other));
      const pd = p.data() as any | undefined;
      await setDoc(doc(db, "users", uid, "friends", other), {
        friendUid: other,
        isCloseFriend: false,
        userName: pd?.userName || null,
        displayName: pd?.displayName || null,
        photoURL: pd?.photoURL || null,
        createdAt: serverTimestamp(),
      });
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not accept request.");
    }
  };

  const rejectRequest = async (req: any) => {
    try {
      await updateDoc(doc(db, "friendRequests", req.id), { status: "rejected" });
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not reject request.");
    }
  };

  const cancelRequest = async (req: any) => {
    try {
      await updateDoc(doc(db, "friendRequests", req.id), { status: "cancelled" });
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not cancel request.");
    }
  };

  const unfriend = async (friendUid: string) => {
    if (!uid) return;
    try {
      await deleteDoc(doc(db, "users", uid, "friends", friendUid));
      await addDoc(collection(db, "unfriendSignals"), { fromUid: uid, toUid: friendUid, createdAt: serverTimestamp() });
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not remove friend.");
    }
  };

  const setCloseStatus = async (friendUid: string, next: boolean) => {
    if (!uid) return;
    try {
      await setDoc(doc(db, "users", uid, "friends", friendUid), { isCloseFriend: next, updatedAt: new Date() }, { merge: true });
      await addDoc(collection(db, "closeFriendSignals"), { fromUid: uid, toUid: friendUid, set: next, createdAt: serverTimestamp() });
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not update close friend.");
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FD5308" />
      </View>
    );
  }

  const initial = (displayName || auth.currentUser?.email || "?").trim().charAt(0).toUpperCase();

  const renderUserRow = (userId: string, right: React.ReactNode, key: string) => {
    const p = profiles[userId] || {};
    const f = friends.find((x) => x.friendUid === userId) || {};
    const name = (p.userName || p.displayName || userId).toString();
    const avatar = p.photoURL || f.photoURL || null;
    const init = name.trim().charAt(0).toUpperCase();
    return (
      <View key={key} style={styles.cardRow}>
        <View style={styles.userCell}>
          {avatar ? <Image source={{ uri: avatar }} style={styles.avatarSm} /> : <View style={styles.avatarSmPlaceholder}><Text style={styles.avatarSmInitial}>{init}</Text></View>}
          <TouchableOpacity onPress={() => navigation.navigate("ViewFriends", { uid: userId })} activeOpacity={0.8}>
            <Text style={styles.cardText}>{name}</Text>
          </TouchableOpacity>
        </View>
        {right}
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.avatarWrap}>
        {photoURL ? <Image source={{ uri: photoURL }} style={styles.avatar} /> : <View style={styles.avatarPlaceholder}><Text style={styles.avatarInitial}>{initial}</Text></View>}
        <TouchableOpacity style={styles.photoBtn} onPress={pickImage} disabled={uploading}>
          {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.photoBtnText}>Change Photo</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Display name</Text>
        <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="Your name" />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          value={userName}
          autoCapitalize="none"
          onChangeText={(t) => setUserName(t.replace(/\s+/g, "").toLowerCase())}
          placeholder="username"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={bio}
          onChangeText={setBio}
          placeholder="Tell people about you"
          multiline
          numberOfLines={3}
        />
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save changes</Text>}
      </TouchableOpacity>

      <View style={{ height: 24 }} />

      <Text style={styles.sectionTitle}>Friends</Text>

      <View style={styles.fieldRow}>
        <TextInput
          style={[styles.input, { flex: 1, marginRight: 8 }]}
          value={searchUsername}
          autoCapitalize="none"
          onChangeText={(t) => setSearchUsername(t.replace(/\s+/g, "").toLowerCase())}
          placeholder="Search username to add"
        />
        <TouchableOpacity style={styles.addBtn} onPress={sendFriendRequest} disabled={sending || !searchUsername.trim()}>
          {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.addBtnText}>Add</Text>}
        </TouchableOpacity>
      </View>

      <View style={{ height: 12 }} />

      <Text style={styles.subTitle}>Incoming Requests</Text>
      {requestsLoading ? (
        <ActivityIndicator color="#FD5308" />
      ) : incoming.length === 0 ? (
        <Text style={styles.emptyText}>No incoming requests</Text>
      ) : (
        incoming.map((r) =>
          renderUserRow(
            r.fromUid,
            <View style={styles.rowActions}>
              <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptRequest(r)}><Text style={styles.smallBtnText}>Accept</Text></TouchableOpacity>
              <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectRequest(r)}><Text style={styles.smallBtnText}>Reject</Text></TouchableOpacity>
            </View>,
            r.id
          )
        )
      )}

      <Text style={styles.subTitle}>Sent Requests</Text>
      {requestsLoading ? (
        <ActivityIndicator color="#FD5308" />
      ) : outgoing.length === 0 ? (
        <Text style={styles.emptyText}>No sent requests</Text>
      ) : (
        outgoing.map((r) =>
          renderUserRow(
            r.toUid,
            <TouchableOpacity style={styles.rejectBtn} onPress={() => cancelRequest(r)}><Text style={styles.smallBtnText}>Cancel</Text></TouchableOpacity>,
            r.id
          )
        )
      )}

      <Text style={styles.subTitle}>Your Friends</Text>
      {friends.length === 0 ? (
        <Text style={styles.emptyText}>You have no friends yet</Text>
      ) : (
        friends.map((f) =>
          renderUserRow(
            f.friendUid,
            <View style={styles.rowActions}>
              <TouchableOpacity
                style={f.isCloseFriend ? styles.neutralBtn : styles.closeBtn}
                onPress={() => setCloseStatus(f.friendUid, !f.isCloseFriend)}
              >
                <Text style={styles.smallBtnText}>{f.isCloseFriend ? "Remove Close" : "Add Close Friend"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.unfriendBtn} onPress={() => unfriend(f.friendUid)}>
                <Text style={styles.smallBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>,
            f.id
          )
        )
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  avatarWrap: { alignItems: "center", marginTop: 10, marginBottom: 20 },
  avatar: { width: 120, height: 120, borderRadius: 60 },
  avatarPlaceholder: { width: 120, height: 120, borderRadius: 60, backgroundColor: "#e5e5e5", alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 48, color: "#777", fontWeight: "600" },
  photoBtn: { marginTop: 12, backgroundColor: "#FD5308", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  photoBtnText: { color: "#fff", fontWeight: "600" },
  field: { marginBottom: 16 },
  label: { marginBottom: 6, color: "#333", fontWeight: "600" },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#fff" },
  multiline: { height: 90, textAlignVertical: "top" },
  saveBtn: { backgroundColor: "#FD5308", paddingVertical: 14, borderRadius: 10, alignItems: "center", marginTop: 8 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8, marginTop: 8, color: "#333" },
  fieldRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  addBtn: { backgroundColor: "#FD5308", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, alignItems: "center" },
  addBtnText: { color: "#fff", fontWeight: "700" },
  subTitle: { marginTop: 12, marginBottom: 6, fontWeight: "700", color: "#333" },
  emptyText: { color: "#777" },
  cardRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "#eee", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, backgroundColor: "#fff" },
  cardText: { color: "#333", fontWeight: "600" },
  rowActions: { flexDirection: "row", gap: 8 },
  acceptBtn: { backgroundColor: "#10b981", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  rejectBtn: { backgroundColor: "#ef4444", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  unfriendBtn: { backgroundColor: "#ef4444", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  closeBtn: { backgroundColor: "#3b82f6", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  neutralBtn: { backgroundColor: "#6b7280", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  smallBtnText: { color: "#fff", fontWeight: "700" },
  userCell: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarSm: { width: 36, height: 36, borderRadius: 18 },
  avatarSmPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#e5e5e5", alignItems: "center", justifyContent: "center" },
  avatarSmInitial: { fontSize: 16, color: "#777", fontWeight: "700" },
});
