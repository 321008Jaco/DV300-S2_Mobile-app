import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, Alert, FlatList, ActivityIndicator } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { auth, db } from "../services/firebaseConfig";
import { doc, getDoc, setDoc, updateDoc, getDocs, query, where, arrayUnion, arrayRemove, collection } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { SafeAreaView } from "react-native-safe-area-context";

type Friend = {
  uid: string;
  displayName?: string;
  username?: string;
  photoURL?: string;
};

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [closeFriends, setCloseFriends] = useState<string[]>([]);
  const [addFriendInput, setAddFriendInput] = useState("");
  const storage = getStorage();
  const uid = auth.currentUser?.uid || null;

  const loadProfile = async () => {
    if (!uid) return;
    setLoading(true);
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      setDisplayName(data.displayName || "");
      setUsername(data.username || "");
      setBio(data.bio || "");
      setPhotoURL(data.photoURL || null);
      const friendIds: string[] = data.friends || [];
      const closeIds: string[] = data.closeFriends || [];
      setCloseFriends(closeIds);
      if (friendIds.length) {
        const fetched: Friend[] = [];
        for (const fid of friendIds) {
          const fSnap = await getDoc(doc(db, "users", fid));
          if (fSnap.exists()) {
            const fd = fSnap.data();
            fetched.push({ uid: fid, displayName: fd.displayName, username: fd.username, photoURL: fd.photoURL });
          }
        }
        setFriends(fetched);
      } else {
        setFriends([]);
      }
    } else {
      await setDoc(userRef, {
        displayName: "",
        username: "",
        bio: "",
        photoURL: null,
        friends: [],
        closeFriends: [],
        email: auth.currentUser?.email || "",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow photo library access.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      await uploadProfilePhoto(uri);
    }
  };

  const uploadProfilePhoto = async (uri: string) => {
    try {
      if (!uid) return;
      setSaving(true);
      const res = await fetch(uri);
      const blob = await res.blob();
      const storageRef = ref(storage, `profilePictures/${uid}.jpg`);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "users", uid), { photoURL: url, updatedAt: new Date() });
      setPhotoURL(url);
      setSaving(false);
    } catch (e) {
      setSaving(false);
      Alert.alert("Upload failed", "Could not upload profile picture.");
    }
  };

  const saveProfile = async () => {
    try {
      if (!uid) return;
      setSaving(true);
      if (username.trim()) {
        const qs = await getDocs(query(collection(db, "users"), where("username", "==", username.trim().toLowerCase())));
        const taken = qs.docs.some((d) => d.id !== uid);
        if (taken) {
          setSaving(false);
          Alert.alert("Username taken", "Please choose another username.");
          return;
        }
      }
      await updateDoc(doc(db, "users", uid), {
        displayName: displayName.trim(),
        username: username.trim().toLowerCase(),
        bio: bio.trim(),
        updatedAt: new Date(),
      });
      setSaving(false);
      Alert.alert("Saved", "Profile updated.");
      loadProfile();
    } catch (e) {
      setSaving(false);
      Alert.alert("Error", "Could not save profile.");
    }
  };

  const addFriend = async () => {
    try {
      if (!uid) return;
      const input = addFriendInput.trim().toLowerCase();
      if (!input) return;
      let targetId: string | null = null;
      if (input.includes("@")) {
        const qs = await getDocs(query(collection(db, "users"), where("email", "==", input)));
        if (!qs.empty) targetId = qs.docs[0].id;
      } else {
        const qs = await getDocs(query(collection(db, "users"), where("username", "==", input)));
        if (!qs.empty) targetId = qs.docs[0].id;
      }
      if (!targetId) {
        Alert.alert("Not found", "No user for that email/username.");
        return;
      }
      if (targetId === uid) {
        Alert.alert("Oops", "You cannot add yourself.");
        return;
      }
      await updateDoc(doc(db, "users", uid), { friends: arrayUnion(targetId), updatedAt: new Date() });
      await updateDoc(doc(db, "users", targetId), { friends: arrayUnion(uid), updatedAt: new Date() });
      setAddFriendInput("");
      loadProfile();
    } catch (e) {
      Alert.alert("Error", "Could not add friend.");
    }
  };

  const removeFriend = async (friendUid: string) => {
    try {
      if (!uid) return;
      await updateDoc(doc(db, "users", uid), { friends: arrayRemove(friendUid), closeFriends: arrayRemove(friendUid), updatedAt: new Date() });
      await updateDoc(doc(db, "users", friendUid), { friends: arrayRemove(uid), closeFriends: arrayRemove(uid), updatedAt: new Date() });
      loadProfile();
    } catch {
      Alert.alert("Error", "Could not remove friend.");
    }
  };

  const toggleCloseFriend = async (friendUid: string) => {
    try {
      if (!uid) return;
      const isClose = closeFriends.includes(friendUid);
      await updateDoc(doc(db, "users", uid), {
        closeFriends: isClose ? arrayRemove(friendUid) : arrayUnion(friendUid),
        updatedAt: new Date(),
      });
      setCloseFriends((prev) => (isClose ? prev.filter((id) => id !== friendUid) : [...prev, friendUid]));
    } catch {
      Alert.alert("Error", "Could not update close friends.");
    }
  };

  const renderFriend = ({ item }: { item: Friend }) => {
    const isClose = closeFriends.includes(item.uid);
    return (
      <View style={styles.friendRow}>
        <Image source={{ uri: item.photoURL || "https://i.pravatar.cc/100" }} style={styles.friendAvatar} />
        <View style={{ flex: 1 }}>
          <Text style={styles.friendName}>{item.displayName || item.username || "User"}</Text>
          <Text style={styles.friendSub}>@{item.username || "unknown"}</Text>
        </View>
        <TouchableOpacity style={[styles.closeBtn, isClose && styles.closeBtnActive]} onPress={() => toggleCloseFriend(item.uid)}>
          <Text style={styles.closeBtnText}>{isClose ? "Close" : "Make Close"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.removeBtn} onPress={() => removeFriend(item.uid)}>
          <Text style={styles.removeBtnText}>Remove</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (!uid) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text>Please log in to manage your profile.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FD5308" />
        </View>
      </SafeAreaView>
    );
  }

  const Header = (
    <View style={styles.headerWrap}>
      <View style={styles.header}>
        <TouchableOpacity onPress={pickImage}>
          <Image source={{ uri: photoURL || "https://i.pravatar.cc/150" }} style={styles.avatar} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <TextInput placeholder="Display name" style={styles.input} value={displayName} onChangeText={setDisplayName} />
          <TextInput placeholder="Username" autoCapitalize="none" style={styles.input} value={username} onChangeText={setUsername} />
        </View>
      </View>
      <TextInput placeholder="Bio" multiline style={[styles.input, styles.bio]} value={bio} onChangeText={setBio} />
      <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} disabled={saving} onPress={saveProfile}>
        <Text style={styles.saveText}>{saving ? "Saving..." : "Save Profile"}</Text>
      </TouchableOpacity>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Friends</Text>
        <View style={styles.addRow}>
          <TextInput
            placeholder="Email or username"
            style={[styles.input, { flex: 1 }]}
            value={addFriendInput}
            onChangeText={setAddFriendInput}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.addBtn} onPress={addFriend}>
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={friends}
        keyExtractor={(item) => item.uid}
        renderItem={renderFriend}
        ListHeaderComponent={Header}
        ListEmptyComponent={<Text style={styles.empty}>No friends yet.</Text>}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  listContent: { padding: 16, paddingBottom: 40 },
  headerWrap: { marginBottom: 8 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: "#eee" },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  bio: { minHeight: 80, textAlignVertical: "top" },
  saveBtn: { backgroundColor: "#FD5308", paddingVertical: 12, borderRadius: 10, alignItems: "center", marginBottom: 20 },
  saveText: { color: "#fff", fontWeight: "700" },
  section: { marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 10 },
  addRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  addBtn: { backgroundColor: "#FD5308", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  addBtnText: { color: "#fff", fontWeight: "700" },
  friendRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  friendAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#eee", marginRight: 12 },
  friendName: { fontWeight: "700" },
  friendSub: { color: "#666" },
  closeBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "#ccc", marginRight: 8 },
  closeBtnActive: { backgroundColor: "#FD5308" },
  closeBtnText: { color: "#fff", fontWeight: "700" },
  removeBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "#222" },
  removeBtnText: { color: "#fff", fontWeight: "700" },
  empty: { color: "#666", textAlign: "center", paddingVertical: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
