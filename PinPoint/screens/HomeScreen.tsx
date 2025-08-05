import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { auth } from "../firebaseConfig";
import MapView, { Marker, MapPressEvent as RNMapPressEvent } from "react-native-maps";

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState("Tab1");
  const [markers, setMarkers] = useState<{ latitude: number; longitude: number }[]>([]);

  const handleMapPress = (event: RNMapPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setMarkers([...markers, { latitude, longitude }]);
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: -25.7479,
          longitude: 28.2293,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onPress={handleMapPress}
      >
        {markers.map((marker, index) => (
          <Marker key={index} coordinate={marker} title={`Pin ${index + 1}`} />
        ))}
      </MapView>

      {/* Top Tabs */}
      <View style={styles.topTabs}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "Tab1" && styles.activeTab]}
          onPress={() => setActiveTab("Tab1")}
        >
          <Text style={[styles.tabText, activeTab === "Tab1" && styles.activeTabText]}>
            Gems
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "Tab2" && styles.activeTab]}
          onPress={() => setActiveTab("Tab2")}
        >
          <Text style={[styles.tabText, activeTab === "Tab2" && styles.activeTabText]}>
            My Pins
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  topTabs: {
    position: "absolute",
    top: 40,
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: "#ddd",
    borderRadius: 25,
    padding: 5,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginHorizontal: 5,
    backgroundColor: "#ccc",
  },
  activeTab: {
    backgroundColor: "#FD5308",
  },
  tabText: {
    color: "#555",
    fontWeight: "600",
  },
  activeTabText: {
    color: "#fff",
  },
});
