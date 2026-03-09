import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';

interface Store {
  latitude: number;
  longitude: number;
  name: string;
  address: string;
  distance?: number;
}

interface SupermarketMapScreenProps {
  supermarkets: Store[];
  radius: number;
  onRefresh: () => void;
}

interface LocationType {
  coords: {
    latitude: number;
    longitude: number;
  };
}

const SupermarketMapScreen: React.FC<SupermarketMapScreenProps> = ({ supermarkets, radius, onRefresh }) => {
  const [location, setLocation] = useState<LocationType | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        setLoading(false);
        return;
      }
      let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc);
      setLoading(false);
    })();
  }, [onRefresh]);

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" color="#2196F3" />;
  }

  if (errorMsg) {
    return (
      <View style={styles.centered}>
        <Text>{errorMsg}</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.button}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const region = location
    ? {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : null;

  return (
    <View style={styles.container}>
      {region && (
        <MapView style={styles.map} region={region} showsUserLocation>
          <Circle
            center={{ latitude: region.latitude, longitude: region.longitude }}
            radius={radius}
            strokeColor="#2196F3"
            fillColor="rgba(33,150,243,0.2)"
          />
          {supermarkets.map((store, idx) => (
            <Marker
              key={idx}
              coordinate={{ latitude: store.latitude, longitude: store.longitude }}
              title={store.name}
              description={store.address}
            />
          ))}
        </MapView>
      )}
      {/* Add radius slider, refresh button, and results list as needed */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.7,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#2196F3',
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default SupermarketMapScreen;
