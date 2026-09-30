import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { ScreenContainer, Header, Card, CardHeader, CardBody, Badge, Button, Spacer, LoadingOverlay } from '@/components';
import { apiService } from '@/services/api.service';
import useAppStore from '@/store/app.store';

export const InspectionReviewScreen = ({ navigation, route }: any) => {
  const { formData, photos, checklist, signature } = route.params;
  const [loading, setLoading] = useState(false);
  const { addToQueue, isOnline } = useAppStore();

  const completedItems = checklist.filter((item: any) => item.completed).length;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const inspectionData = {
        ...formData,
        photos,
        checklist,
        signature,
        status: 'submitted',
        submittedAt: new Date().toISOString(),
      };

      if (isOnline) {
        // Submit directly
        await apiService.createInspection(inspectionData);
        navigation.navigate('Inspections');
      } else {
        // Add to offline queue
        addToQueue({
          action: 'create',
          entity: 'inspection',
          data: inspectionData,
        });
        navigation.navigate('Inspections');
      }
    } catch (error) {
      alert('Failed to submit inspection. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    setLoading(true);
    try {
      const draftData = {
        ...formData,
        photos,
        checklist,
        signature,
        status: 'draft',
        savedAt: new Date().toISOString(),
      };

      // Save to local database
      await apiService.saveDraft(draftData);
      navigation.navigate('Inspections');
    } catch (error) {
      alert('Failed to save draft');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scrollable>
      <Header title="Review & Submit" />

      <LoadingOverlay visible={loading} />

      <Spacer size="medium" />

      {/* Basic info */}
      <Card>
        <CardHeader>
          <View>
            <Badge label="Inspection Details" />
          </View>
        </CardHeader>
        <CardBody>
          <View style={styles.row}>
            <View style={styles.label}>Type:</View>
            <View style={styles.value}>{formData.type}</View>
          </View>
          <View style={styles.row}>
            <View style={styles.label}>Title:</View>
            <View style={styles.value}>{formData.title}</View>
          </View>
        </CardBody>
      </Card>

      <Spacer size="small" />

      {/* Photos summary */}
      <Card>
        <CardHeader>
          <Badge label={`Photos (${photos.length})`} />
        </CardHeader>
        <CardBody>
          <View style={styles.row}>
            <View style={styles.label}>Captured:</View>
            <View style={styles.value}>{photos.length} photo(s)</View>
          </View>
        </CardBody>
      </Card>

      <Spacer size="small" />

      {/* Checklist summary */}
      <Card>
        <CardHeader>
          <Badge label={`Checklist (${completedItems}/${checklist.length})`} />
        </CardHeader>
        <CardBody>
          <View style={styles.row}>
            <View style={styles.label}>Completed:</View>
            <View style={styles.value}>{completedItems}/{checklist.length}</View>
          </View>
        </CardBody>
      </Card>

      <Spacer size="small" />

      {/* Inspector info */}
      <Card>
        <CardHeader>
          <Badge label="Inspector" />
        </CardHeader>
        <CardBody>
          <View style={styles.row}>
            <View style={styles.label}>Name:</View>
            <View style={styles.value}>{signature.inspectorName}</View>
          </View>
        </CardBody>
      </Card>

      <Spacer size="medium" />

      {/* Action buttons */}
      <View style={styles.buttonContainer}>
        <Button
          title="Save as Draft"
          onPress={handleSaveDraft}
          variant="secondary"
          style={styles.button}
        />
        <Button
          title="Submit"
          onPress={handleSubmit}
          style={styles.button}
        />
      </View>

      <Spacer size="large" />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  label: {
    flex: 1,
    fontWeight: '600',
    paddingRight: 10,
  },
  value: {
    flex: 2,
    color: '#666',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
  },
});
