import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { ScreenContainer, Header, Card, CardBody, CardHeader, TextInput, Select, Button, Spacer } from '@/components';

interface CreateInspectionFormData {
  projectId: string;
  title: string;
  description: string;
  type: string;
}

export const CreateInspectionScreen = ({ navigation, route }: any) => {
  const [formData, setFormData] = useState<CreateInspectionFormData>({
    projectId: '',
    title: '',
    description: '',
    type: 'routine',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleChange = (field: keyof CreateInspectionFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.projectId) newErrors.projectId = 'Project is required';
    if (!formData.title) newErrors.title = 'Title is required';
    if (!formData.type) newErrors.type = 'Type is required';
    return newErrors;
  };

  const handleNext = () => {
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    navigation.navigate('InspectionPhotoCapture', {
      formData,
    });
  };

  const inspectionTypes = [
    { label: 'Routine', value: 'routine' },
    { label: 'Safety', value: 'safety' },
    { label: 'Maintenance', value: 'maintenance' },
    { label: 'Compliance', value: 'compliance' },
    { label: 'Emergency', value: 'emergency' },
  ];

  return (
    <ScreenContainer scrollable>
      <Header title="Create Inspection" />

      <Spacer size="medium" />

      <Card>
        <CardHeader>
          <View>
            {/* Project name goes here */}
          </View>
        </CardHeader>
        <CardBody>
          <TextInput
            label="Project"
            placeholder="Select a project"
            value={formData.projectId}
            onChangeText={(val) => handleChange('projectId', val)}
            error={errors.projectId}
            editable={false}
          />

          <Spacer size="small" />

          <Select
            label="Inspection Type"
            options={inspectionTypes}
            value={formData.type}
            onValueChange={(val) => handleChange('type', val)}
            error={errors.type}
          />

          <Spacer size="small" />

          <TextInput
            label="Title"
            placeholder="e.g., Annual Safety Inspection"
            value={formData.title}
            onChangeText={(val) => handleChange('title', val)}
            error={errors.title}
          />

          <Spacer size="small" />

          <TextInput
            label="Description"
            placeholder="Additional notes or details"
            value={formData.description}
            onChangeText={(val) => handleChange('description', val)}
            multiline
            numberOfLines={4}
          />

          <Spacer size="medium" />

          <View style={styles.buttonContainer}>
            <Button
              title="Cancel"
              onPress={() => navigation.goBack()}
              variant="secondary"
              style={styles.button}
            />
            <Button
              title="Next"
              onPress={handleNext}
              loading={loading}
              style={styles.button}
            />
          </View>
        </CardBody>
      </Card>

      <Spacer size="large" />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
  },
});
