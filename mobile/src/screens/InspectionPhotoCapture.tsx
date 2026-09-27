import React, { useState, useRef } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { ScreenContainer, Header, Card, CardBody, Badge, Button, Spacer, Spinner } from '@/components';

interface CapturedPhoto {
  id: string;
  uri: string;
  timestamp: string;
  notes: string;
}

export const InspectionPhotoCaptureScreen = ({ navigation, route }: any) => {
  const { formData } = route.params;
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [currentNotes, setCurrentNotes] = useState('');
  const cameraRef = useRef(null);

  const handleCapturePhoto = async () => {
    // Camera capture would be implemented here
    // For now, placeholder for photo capture logic
    const newPhoto: CapturedPhoto = {
      id: Date.now().toString(),
      uri: `file://photo-${Date.now()}.jpg`,
      timestamp: new Date().toISOString(),
      notes: currentNotes,
    };
    setPhotos((prev) => [...prev, newPhoto]);
    setCurrentNotes('');
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const handleNext = () => {
    navigation.navigate('InspectionChecklist', {
      formData,
      photos,
    });
  };

  return (
    <ScreenContainer scrollable={false}>
      <Header title="Capture Photos" />

      <View style={styles.container}>
        {/* Camera preview area */}
        <View style={styles.cameraPreview}>
          <TouchableOpacity
            style={styles.captureButton}
            onPress={handleCapturePhoto}
          >
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
        </View>

        <Spacer size="small" />

        {/* Photos list */}
        <View style={styles.photosList}>
          <FlatList
            testID="photos-list"
            data={photos}
            keyExtractor={(item) => item.id}
            numColumns={3}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.photoThumbnail}
                onPress={() => handleRemovePhoto(item.id)}
              >
                <View style={styles.photoPlaceholder}>
                  <Badge label={`${photos.indexOf(item) + 1}`} size="small" />
                </View>
              </TouchableOpacity>
            )}
          />
        </View>

        <Spacer size="small" />

        {/* Bottom buttons */}
        <View style={styles.buttonContainer}>
          <Button
            title="Back"
            onPress={() => navigation.goBack()}
            variant="secondary"
            style={styles.button}
          />
          <Button
            title={`Next (${photos.length} photos)`}
            onPress={handleNext}
            disabled={photos.length === 0}
            style={styles.button}
          />
        </View>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  cameraPreview: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: 8,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 20,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1976D2',
  },
  photosList: {
    height: 120,
  },
  photoThumbnail: {
    flex: 1,
    margin: 4,
  },
  photoPlaceholder: {
    flex: 1,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
  },
});
