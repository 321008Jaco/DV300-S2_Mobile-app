import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, Alert } from "react-native";
import MapView, { Marker, MapPressEvent } from "react-native-maps";
import * as Location from "expo-location";
import { auth, db } from "../firebaseConfig";
import { collection, addDoc, onSnapshot } from "firebase/firestore";

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

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission is required.");
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });
    })();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "pins"), (snapshot) => {
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
  }, []);

  const handleMapPress = (event: MapPressEvent) => {
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
      console.error("Error adding pin:", error);
      Alert.alert("Error", "Could not add pin to Firestore");
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: userLocation?.latitude || -25.7479,
          longitude: userLocation?.longitude || 28.2293,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onPress={handleMapPress}
      >
        {userLocation && <Marker coordinate={userLocation} title="You are here" pinColor="#FD5308" />}
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
            title={marker.name}
            description={marker.type}
            pinColor={marker.isPublic ? "#FD5308" : "#FD5308"}
          />
        ))}
      </MapView>

      <View style={styles.overlay}>
        <Text style={styles.overlayText}>Logged in as: {auth.currentUser?.email || "Unknown"}</Text>
      </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  overlay: {
    position: "absolute",
    top: 40,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 8,
    borderRadius: 8,
  },
  overlayText: { color: "#fff", fontWeight: "bold" },
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
  activeToggle: {
    backgroundColor: "#FD5308",
  },
  activeText: {
    color: "#fff",
    fontWeight: "600",
  },
  inactiveText: {
    color: "#333",
  },
  confirmButton: {
    backgroundColor: "#FD5308",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  confirmText: {
    color: "#fff",
    fontSize: 16,
  },
  cancelButton: {
    backgroundColor: "#ccc",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  cancelText: {
    color: "#333",
    fontSize: 16,
  },
});
