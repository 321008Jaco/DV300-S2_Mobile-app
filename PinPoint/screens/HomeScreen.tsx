import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, Alert, Linking, Image } from "react-native";
import MapView, { Marker, MapPressEvent, Region, LongPressEvent, PROVIDER_GOOGLE } from "react-native-maps";
import { Platform } from "react-native";
import * as Location from "expo-location";
import { auth, db } from "../services/firebaseConfig";
import { collection, addDoc, onSnapshot, query, where, doc, updateDoc, deleteDoc, getDoc } from "firebase/firestore";
import { SafeAreaView } from "react-native-safe-area-context";

let hasShownOnboarding = false;

type Pin = {
  id?: string;
  latitude: number;
  longitude: number;
  name: string;
  type: string;
  isPublic: boolean;
  userId: string | null;
  visibility?: "public" | "private" | "close";
};

export default function HomeScreen() {
  const [markers, setMarkers] = useState<Pin[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newPin, setNewPin] = useState({ name: "", type: "", visibility: "public" as "public" | "private" | "close" });
  const [pendingCoords, setPendingCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [activeTab, setActiveTab] = useState<"global" | "private" | "close">("global");
  const [selectedMarker, setSelectedMarker] = useState<Pin | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [editPin, setEditPin] = useState({ name: "", type: "", visibility: "public" as "public" | "private" | "close" });
  const [creatorProfiles, setCreatorProfiles] = useState<Record<string, { photoURL?: string | null; userName?: string; displayName?: string }>>({});
  const [closeFriendIds, setCloseFriendIds] = useState<string[]>([]);
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (!hasShownOnboarding) {
      setOnboardingVisible(true);
      hasShownOnboarding = true;
    }
  }, []);

useEffect(() => {
  let sub: Location.LocationSubscription | null = null;
  (async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;
    const pos = await Location.getCurrentPositionAsync({});
    setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 2000,
        distanceInterval: 5,
      },
      (loc) => {
        const { latitude, longitude } = loc.coords;
        setUserLocation({ latitude, longitude });
      }
    );
  })();
  return () => { sub && sub.remove(); };
}, []);

  useEffect(() => {
    if (!userLocation) return;
    const region: Region = {
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
    mapRef.current?.animateToRegion(region, 800);
  }, [userLocation]);

  useEffect(() => {
    const me = auth.currentUser?.uid || "";
    if (!me) return;
    const unsub = onSnapshot(collection(db, "users", me, "friends"), (snap) => {
      const ids: string[] = [];
      snap.forEach((d) => {
        const x = d.data() as any;
        if (x.isCloseFriend && x.friendUid) ids.push(x.friendUid);
      });
      setCloseFriendIds(ids);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const me = auth.currentUser?.uid || "";
    let unsub: any;
    if (activeTab === "global") {
      const q1 = query(collection(db, "pins"), where("isPublic", "==", true));
      unsub = onSnapshot(q1, (snapshot) => {
        const list: Pin[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data() as any;
          list.push({
            id: docSnap.id,
            latitude: d.latitude,
            longitude: d.longitude,
            name: d.name,
            type: d.type,
            isPublic: d.isPublic,
            userId: d.userId,
            visibility: d.visibility || (d.isPublic ? "public" : "private"),
          });
        });
        setMarkers(list);
      });
    } else if (activeTab === "private") {
      const q2 = query(collection(db, "pins"), where("userId", "==", me));
      unsub = onSnapshot(q2, (snapshot) => {
        const list: Pin[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data() as any;
          const vis = (d.visibility as string) ?? (d.isPublic ? "public" : "private");
          if (vis === "private") {
            list.push({
              id: docSnap.id,
              latitude: d.latitude,
              longitude: d.longitude,
              name: d.name,
              type: d.type,
              isPublic: d.isPublic,
              userId: d.userId,
              visibility: vis,
            });
          }
        });
        setMarkers(list);
      });
    } else {
      if (!closeFriendIds || closeFriendIds.length === 0) {
        setMarkers([]);
        return;
      }
      const batch = closeFriendIds.slice(0, 10);
      const q3 = query(collection(db, "pins"), where("visibility", "==", "close"), where("userId", "in", batch));
      unsub = onSnapshot(q3, (snapshot) => {
        const list: Pin[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data() as any;
          list.push({
            id: docSnap.id,
            latitude: d.latitude,
            longitude: d.longitude,
            name: d.name,
            type: d.type,
            isPublic: d.isPublic,
            userId: d.userId,
            visibility: d.visibility || (d.isPublic ? "public" : "private"),
          });
        });
        setMarkers(list);
      });
    }
    return () => unsub && unsub();
  }, [activeTab, closeFriendIds]);

  useEffect(() => {
    const uids = Array.from(new Set(markers.map((m) => m.userId).filter((x): x is string => !!x)));
    const missing = uids.filter((u) => !creatorProfiles[u]);
    if (missing.length === 0) return;
    (async () => {
      const entries: [string, { photoURL?: string | null; userName?: string; displayName?: string }][] = [];
      for (const uid of missing) {
        const snap = await getDoc(doc(db, "publicProfiles", uid));
        const d = (snap.exists() ? (snap.data() as any) : {}) || {};
        entries.push([uid, { photoURL: d.photoURL || null, userName: d.userName || "", displayName: d.displayName || "" }]);
      }
      setCreatorProfiles((prev) => {
        const next = { ...prev };
        for (const [k, v] of entries) next[k] = v;
        return next;
      });
    })();
  }, [markers]);

  const handleMapPress = (event: MapPressEvent) => {
    if (selectedMarker) {
      setSelectedMarker(null);
      return;
    }
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setPendingCoords({ latitude, longitude });
    setModalVisible(true);
  };

  const handleLongPress = (event: LongPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setPendingCoords({ latitude, longitude });
    setModalVisible(true);
  };

  const handleAddPin = async () => {
    if (!pendingCoords) {
      Alert.alert("Error", "No location selected for the pin");
      return;
    }
    try {
      await addDoc(collection(db, "pins"), {
        latitude: pendingCoords.latitude,
        longitude: pendingCoords.longitude,
        name: newPin.name,
        type: newPin.type,
        isPublic: newPin.visibility === "public",
        visibility: newPin.visibility,
        userId: auth.currentUser?.uid || null,
        createdAt: new Date(),
      });
      setNewPin({ name: "", type: "", visibility: "public" });
      setPendingCoords(null);
      setModalVisible(false);
    } catch {
      Alert.alert("Error", "Could not add pin to Firestore");
    }
  };

  const handleWaypoint = () => {
    if (!selectedMarker) {
      Alert.alert("Error", "No pin selected");
      return;
    }
    const { latitude, longitude } = selectedMarker;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    Linking.openURL(url);
  };

  const openEdit = () => {
    if (!selectedMarker) return;
    const vis = selectedMarker.visibility || (selectedMarker.isPublic ? "public" : "private");
    setEditPin({ name: selectedMarker.name, type: selectedMarker.type, visibility: vis as any });
    setEditVisible(true);
  };

  const handleUpdatePin = async () => {
    if (!selectedMarker?.id) return;
    try {
      await updateDoc(doc(db, "pins", selectedMarker.id), {
        name: editPin.name,
        type: editPin.type,
        isPublic: editPin.visibility === "public",
        visibility: editPin.visibility,
        updatedAt: new Date(),
      });
      setEditVisible(false);
      setSelectedMarker((prev) =>
        prev ? { ...prev, name: editPin.name, type: editPin.type, isPublic: editPin.visibility === "public", visibility: editPin.visibility } : prev
      );
    } catch {
      Alert.alert("Error", "Could not update pin");
    }
  };

  const handleDeletePin = async () => {
    if (!selectedMarker?.id) return;
    try {
      await deleteDoc(doc(db, "pins", selectedMarker.id));
      setEditVisible(false);
      setSelectedMarker(null);
    } catch {
      Alert.alert("Error", "Could not delete pin");
    }
  };

  const orange = "#FD5308";

  const PinMarker = ({ uri, initial }: { uri: string | null; initial: string }) => (
    <View style={styles.pin}>
      <View style={[styles.pinRing, { borderColor: orange }]}>
        {uri ? (
          <Image source={{ uri }} style={styles.pinImg} />
        ) : (
          <View style={[styles.pinFallback, { backgroundColor: orange }]}>
            <Text style={styles.pinInitial}>{initial}</Text>
          </View>
        )}
      </View>
      <View style={[styles.pinDiamond, { backgroundColor: orange }]} />
    </View>
  );

  const enableLocationFromOnboarding = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === "granted") {
      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tabButton, activeTab === "global" && styles.activeTab]} onPress={() => setActiveTab("global")}>
          <Text style={activeTab === "global" ? styles.activeTabText : styles.tabText}>Global</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabButton, activeTab === "private" && styles.activeTab]} onPress={() => setActiveTab("private")}>
          <Text style={activeTab === "private" ? styles.activeTabText : styles.tabText}>Private</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabButton, activeTab === "close" && styles.activeTab]} onPress={() => setActiveTab("close")}>
          <Text style={activeTab === "close" ? styles.activeTabText : styles.tabText}>Close Friends</Text>
        </TouchableOpacity>
      </View>

      <MapView
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: userLocation?.latitude || -25.7479,
          longitude: userLocation?.longitude || 28.2293,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onPress={() => {
          if (selectedMarker) setSelectedMarker(null);
        }}
        onLongPress={handleLongPress}
      >
        {userLocation && <Marker coordinate={userLocation} title="You are here" pinColor="#FD5308" />}
        {markers.map((marker) => {
          const creator = (marker.userId && creatorProfiles[marker.userId]) || {};
          const uri = creator.photoURL || null;
          const name = creator.userName || creator.displayName || "U";
          const initial = name.trim().charAt(0).toUpperCase();
          return (
            <Marker key={marker.id} coordinate={{ latitude: marker.latitude, longitude: marker.longitude }} onPress={() => setSelectedMarker(marker)} tracksViewChanges>
              <PinMarker uri={uri} initial={initial} />
            </Marker>
          );
        })}
      </MapView>

      {selectedMarker && (
        <View style={styles.markerDetails}>
          <Text style={styles.markerTitle}>{selectedMarker.name}</Text>
          <Text>{selectedMarker.type}</Text>
          <Text style={{ marginTop: 6, color: "#666" }}>{(selectedMarker.visibility || (selectedMarker.isPublic ? "public" : "private")).toUpperCase()}</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.waypointButton} onPress={handleWaypoint}>
              <Text style={styles.waypointText}>Waypoint</Text>
            </TouchableOpacity>
            {selectedMarker.userId === (auth.currentUser?.uid || null) && (
              <TouchableOpacity style={styles.editButton} onPress={openEdit}>
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => {
          if (userLocation) {
            setPendingCoords(userLocation);
            setModalVisible(true);
          } else {
            Alert.alert("Error", "User location not found");
          }
        }}
      >
        <Text style={styles.addButtonText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TextInput placeholder="Pin Name" style={styles.input} value={newPin.name} onChangeText={(text) => setNewPin({ ...newPin, name: text })} />
            <TextInput placeholder="Type of Place" style={styles.input} value={newPin.type} onChangeText={(text) => setNewPin({ ...newPin, type: text })} />
            <View style={styles.visibilityRow}>
              <TouchableOpacity
                style={[styles.visibilityBtn, newPin.visibility === "public" && styles.visibilityActive]}
                onPress={() => setNewPin({ ...newPin, visibility: "public" })}
              >
                <Text style={newPin.visibility === "public" ? styles.visibilityActiveText : styles.visibilityText}>Public</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.visibilityBtn, newPin.visibility === "private" && styles.visibilityActive]}
                onPress={() => setNewPin({ ...newPin, visibility: "private" })}
              >
                <Text style={newPin.visibility === "private" ? styles.visibilityActiveText : styles.visibilityText}>Private</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.visibilityBtn, newPin.visibility === "close" && styles.visibilityActive]}
                onPress={() => setNewPin({ ...newPin, visibility: "close" })}
              >
                <Text style={newPin.visibility === "close" ? styles.visibilityActiveText : styles.visibilityText}>Close Friends</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.confirmButton} onPress={handleAddPin}>
              <Text style={styles.confirmText}>Add Pin</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => { setModalVisible(false); setPendingCoords(null); }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={editVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TextInput placeholder="Pin Name" style={styles.input} value={editPin.name} onChangeText={(text) => setEditPin({ ...editPin, name: text })} />
            <TextInput placeholder="Type of Place" style={styles.input} value={editPin.type} onChangeText={(text) => setEditPin({ ...editPin, type: text })} />
            <View style={styles.visibilityRow}>
              <TouchableOpacity
                style={[styles.visibilityBtn, editPin.visibility === "public" && styles.visibilityActive]}
                onPress={() => setEditPin({ ...editPin, visibility: "public" })}
              >
                <Text style={editPin.visibility === "public" ? styles.visibilityActiveText : styles.visibilityText}>Public</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.visibilityBtn, editPin.visibility === "private" && styles.visibilityActive]}
                onPress={() => setEditPin({ ...editPin, visibility: "private" })}
              >
                <Text style={editPin.visibility === "private" ? styles.visibilityActiveText : styles.visibilityText}>Private</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.visibilityBtn, editPin.visibility === "close" && styles.visibilityActive]}
                onPress={() => setEditPin({ ...editPin, visibility: "close" })}
              >
                <Text style={editPin.visibility === "close" ? styles.visibilityActiveText : styles.visibilityText}>Close Friends</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.confirmButton} onPress={handleUpdatePin}>
              <Text style={styles.confirmText}>Save Changes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteButton} onPress={handleDeletePin}>
              <Text style={styles.deleteText}>Delete Pin</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setEditVisible(false)}>
              <Text style={styles.cancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={onboardingVisible} transparent animationType="fade">
        <View style={styles.onboardBackdrop}>
          <View style={styles.onboardCard}>
            {onboardingStep === 0 && (
              <View style={styles.onboardInner}>
                <Text style={styles.onboardTitle}>Welcome to PinPoint</Text>
                <Text style={styles.onboardText}>Drop pins, share with friends, and keep private or close-friends spots.</Text>
                <View style={styles.onboardDots}>
                  <View style={[styles.dot, styles.dotActive]} />
                  <View style={styles.dot} />
                  <View style={styles.dot} />
                </View>
                <TouchableOpacity style={styles.onboardPrimary} onPress={() => setOnboardingStep(1)}>
                  <Text style={styles.onboardPrimaryText}>Next</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.onboardGhost} onPress={() => setOnboardingVisible(false)}>
                  <Text style={styles.onboardGhostText}>Skip</Text>
                </TouchableOpacity>
              </View>
            )}
            {onboardingStep === 1 && (
              <View style={styles.onboardInner}>
                <Text style={styles.onboardTitle}>Enable Location</Text>
                <Text style={styles.onboardText}>We use your location to center the map and help you add pins faster.</Text>
                <View style={styles.onboardDots}>
                  <View style={styles.dot} />
                  <View style={[styles.dot, styles.dotActive]} />
                  <View style={styles.dot} />
                </View>
                <TouchableOpacity style={styles.onboardPrimary} onPress={enableLocationFromOnboarding}>
                  <Text style={styles.onboardPrimaryText}>Enable Location</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.onboardGhost} onPress={() => setOnboardingStep(2)}>
                  <Text style={styles.onboardGhostText}>Next</Text>
                </TouchableOpacity>
              </View>
            )}
            {onboardingStep === 2 && (
              <View style={styles.onboardInner}>
                <Text style={styles.onboardTitle}>Add a Pin</Text>
                <Text style={styles.onboardText}>Long-press the map to drop a pin. Choose Public, Private, or Close Friends visibility.</Text>
                <View style={styles.onboardDots}>
                  <View style={styles.dot} />
                  <View style={styles.dot} />
                  <View style={[styles.dot, styles.dotActive]} />
                </View>
                <TouchableOpacity style={styles.onboardPrimary} onPress={() => setOnboardingVisible(false)}>
                  <Text style={styles.onboardPrimaryText}>Get Started</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  map: { flex: 1 },
  tabs: { flexDirection: "row", justifyContent: "center", paddingVertical: 10, backgroundColor: "transparent", zIndex: 1 },
  tabButton: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, marginHorizontal: 5, backgroundColor: "rgba(0,0,0,0.1)" },
  activeTab: { backgroundColor: "#FD5308" },
  tabText: { color: "#555", fontWeight: "600" },
  activeTabText: { color: "#fff" },
  addButton: { position: "absolute", bottom: 100, left: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: "#FD5308", justifyContent: "center", alignItems: "center" },
  addButtonText: { fontSize: 30, color: "#fff" },
  modalContainer: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "80%", backgroundColor: "#fff", borderRadius: 10, padding: 20 },
  input: { borderBottomWidth: 1, borderBottomColor: "#ccc", marginBottom: 15, padding: 8 },
  confirmButton: { backgroundColor: "#FD5308", padding: 12, borderRadius: 8, alignItems: "center", marginTop: 10 },
  confirmText: { color: "#fff", fontSize: 16 },
  cancelButton: { backgroundColor: "#ccc", padding: 12, borderRadius: 8, alignItems: "center", marginTop: 10 },
  cancelText: { color: "#333", fontSize: 16 },
  markerDetails: { position: "absolute", bottom: 180, left: 20, right: 20, backgroundColor: "white", padding: 15, borderRadius: 10, elevation: 3 },
  markerTitle: { fontSize: 18, fontWeight: "bold" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  waypointButton: { flex: 1, backgroundColor: "#FD5308", padding: 10, borderRadius: 5, alignItems: "center" },
  waypointText: { color: "white", fontWeight: "bold" },
  editButton: { flex: 1, backgroundColor: "#374151", padding: 10, borderRadius: 5, alignItems: "center" },
  editText: { color: "white", fontWeight: "bold" },
  deleteButton: { backgroundColor: "#ef4444", padding: 12, borderRadius: 8, alignItems: "center", marginTop: 10 },
  deleteText: { color: "#fff", fontSize: 16 },
  visibilityRow: { flexDirection: "row", justifyContent: "space-between", marginVertical: 10 },
  visibilityBtn: { flex: 1, paddingVertical: 10, marginHorizontal: 4, borderRadius: 10, backgroundColor: "#eee", alignItems: "center" },
  visibilityActive: { backgroundColor: "#FD5308" },
  visibilityText: { color: "#333", fontWeight: "600" },
  visibilityActiveText: { color: "#fff", fontWeight: "700" },
  pin: { alignItems: "center" },
  pinRing: { width: 48, height: 48, borderRadius: 24, borderWidth: 4, overflow: "hidden", backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  pinImg: { width: "100%", height: "100%" },
  pinFallback: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  pinInitial: { color: "#fff", fontWeight: "700" },
  pinDiamond: { width: 12, height: 12, transform: [{ rotate: "45deg" }], marginTop: -6, borderRadius: 2 },
  onboardBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  onboardCard: { width: "86%", backgroundColor: "#fff", borderRadius: 16, padding: 20 },
  onboardInner: { alignItems: "center" },
  onboardTitle: { fontSize: 22, fontWeight: "800", color: "#111", textAlign: "center", marginBottom: 8 },
  onboardText: { fontSize: 14, color: "#444", textAlign: "center", lineHeight: 20, marginBottom: 16 },
  onboardDots: { flexDirection: "row", gap: 6, marginBottom: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#e5e7eb" },
  dotActive: { backgroundColor: "#FD5308" },
  onboardPrimary: { backgroundColor: "#FD5308", paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, alignItems: "center", alignSelf: "stretch" },
  onboardPrimaryText: { color: "#fff", fontWeight: "800" },
  onboardGhost: { paddingVertical: 10, alignItems: "center", marginTop: 8, alignSelf: "stretch" },
  onboardGhostText: { color: "#6b7280", fontWeight: "700" },
});
