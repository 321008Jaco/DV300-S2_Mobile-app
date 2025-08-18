import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, Alert, Linking } from "react-native";
import MapView, { Marker, MapPressEvent, Region } from "react-native-maps";
import * as Location from "expo-location";
import { auth, db } from "../services/firebaseConfig";
import { collection, addDoc, onSnapshot, query, where } from "firebase/firestore";
import { SafeAreaView } from "react-native-safe-area-context";

type Pin = {
  id?: string;
  latitude: number;
  longitude: number;
  name: string;
  type: string;
  isPublic: boolean;
  userId: string | null;
};

export default function HomeScreen() {
  const [markers, setMarkers] = useState<Pin[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newPin, setNewPin] = useState({ name: "", type: "", isPublic: true });
  const [pendingCoords, setPendingCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [activeTab, setActiveTab] = useState<"global" | "private">("global");
  const [selectedMarker, setSelectedMarker] = useState<Pin | null>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        let location = await Location.getCurrentPositionAsync({});
        setUserLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });
      }
    })();
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
    const q =
      activeTab === "global"
        ? query(collection(db, "pins"), where("isPublic", "==", true))
        : query(collection(db, "pins"), where("userId", "==", auth.currentUser?.uid || ""));
    const unsub = onSnapshot(q, (snapshot) => {
      const fetchedPins: Pin[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        fetchedPins.push({
          id: doc.id,
          latitude: data.latitude,
          longitude: data.longitude,
          name: data.name,
          type: data.type,
          isPublic: data.isPublic,
          userId: data.userId,
        });
      });
      setMarkers(fetchedPins);
    });
    return () => unsub();
  }, [activeTab]);

  const handleMapPress = (event: MapPressEvent) => {
    if (selectedMarker) {
      setSelectedMarker(null);
      return;
    }
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
        isPublic: newPin.isPublic,
        userId: auth.currentUser?.uid || null,
        createdAt: new Date(),
      });
      setNewPin({ name: "", type: "", isPublic: true });
      setPendingCoords(null);
      setModalVisible(false);
    } catch (error) {
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "global" && styles.activeTab]}
          onPress={() => setActiveTab("global")}
        >
          <Text style={activeTab === "global" ? styles.activeTabText : styles.tabText}>Global</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "private" && styles.activeTab]}
          onPress={() => setActiveTab("private")}
        >
          <Text style={activeTab === "private" ? styles.activeTabText : styles.tabText}>Private</Text>
        </TouchableOpacity>
      </View>

      <MapView
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
          onLongPress={(e) => {
            const { latitude, longitude } = e.nativeEvent.coordinate;
            setPendingCoords({ latitude, longitude });
            setModalVisible(true);
          }}
      >
        {userLocation && <Marker coordinate={userLocation} title="You are here" pinColor="#FD5308" />}
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
            title={marker.name}
            description={marker.type}
            pinColor={marker.isPublic ? "#FD5308" : "blue"}
            onPress={() => setSelectedMarker(marker)}
          />
        ))}
      </MapView>

      {selectedMarker && (
        <View style={styles.markerDetails}>
          <Text style={styles.markerTitle}>{selectedMarker.name}</Text>
          <Text>{selectedMarker.type}</Text>
          <TouchableOpacity style={styles.waypointButton} onPress={handleWaypoint}>
            <Text style={styles.waypointText}>Waypoint</Text>
          </TouchableOpacity>
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
            <TextInput
              placeholder="Pin Name"
              style={styles.input}
              value={newPin.name}
              onChangeText={(text) => setNewPin({ ...newPin, name: text })}
            />
            <TextInput
              placeholder="Type of Place"
              style={styles.input}
              value={newPin.type}
              onChangeText={(text) => setNewPin({ ...newPin, type: text })}
            />
            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[styles.toggleButton, newPin.isPublic && styles.activeToggle]}
                onPress={() => setNewPin({ ...newPin, isPublic: true })}
              >
                <Text style={newPin.isPublic ? styles.activeText : styles.inactiveText}>Public</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, !newPin.isPublic && styles.activeToggle]}
                onPress={() => setNewPin({ ...newPin, isPublic: false })}
              >
                <Text style={!newPin.isPublic ? styles.activeText : styles.inactiveText}>Private</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.confirmButton} onPress={handleAddPin}>
              <Text style={styles.confirmText}>Add Pin</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setModalVisible(false);
                setPendingCoords(null);
              }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  map: { flex: 1 },
  tabs: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 10,
    backgroundColor: "transparent",
    zIndex: 1,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginHorizontal: 5,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  activeTab: { backgroundColor: "#FD5308" },
  tabText: { color: "#555", fontWeight: "600" },
  activeTabText: { color: "#fff" },
  addButton: {
    position: "absolute",
    bottom: 100,
    left: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FD5308",
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonText: { fontSize: 30, color: "#fff" },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    marginBottom: 15,
    padding: 8,
  },
  toggleContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 15,
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: "#ccc",
  },
  activeToggle: { backgroundColor: "#FD5308" },
  activeText: { color: "#fff", fontWeight: "600" },
  inactiveText: { color: "#333" },
  confirmButton: {
    backgroundColor: "#FD5308",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  confirmText: { color: "#fff", fontSize: 16 },
  cancelButton: {
    backgroundColor: "#ccc",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  cancelText: { color: "#333", fontSize: 16 },
  markerDetails: {
    position: "absolute",
    bottom: 180,
    left: 20,
    right: 20,
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
    elevation: 3,
  },
  markerTitle: { fontSize: 18, fontWeight: "bold" },
  waypointButton: {
    marginTop: 10,
    backgroundColor: "#FD5308",
    padding: 10,
    borderRadius: 5,
    alignItems: "center",
  },
  waypointText: { color: "white", fontWeight: "bold" },
});
