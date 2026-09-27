import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { ScreenContainer, Header, Card, CardBody, TextInput, Select, Button, Spacer } from '@/components';

interface WorkOrderFormData {
  projectId: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  estimatedCost: string;
  dueDate: string;
}

export const CreateWorkOrderScreen = ({ navigation }: any) => {
  const [formData, setFormData] = useState<WorkOrderFormData>({
    projectId: '',
    title: '',
    description: '',
    type: 'preventive',
    priority: 'medium',
    estimatedCost: '',
    dueDate: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: keyof WorkOrderFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.projectId) newErrors.projectId = 'Project is required';
    if (!formData.title) newErrors.title = 'Title is required';
    if (!formData.dueDate) newErrors.dueDate = 'Due date is required';
    return newErrors;
  };

  const handleNext = () => {
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    navigation.navigate('AssignWorkOrder', { formData });
  };

  const workOrderTypes = [
    { label: 'Preventive', value: 'preventive' },
    { label: 'Corrective', value: 'corrective' },
    { label: 'Emergency', value: 'emergency' },
  ];

  const priorities = [
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
    { label: 'Critical', value: 'critical' },
  ];

  return (
    <ScreenContainer scrollable>
      <Header title="Create Work Order" />
      <Spacer size="medium" />

      <Card>
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

          <TextInput
            label="Title"
            placeholder="e.g., Pump maintenance"
            value={formData.title}
            onChangeText={(val) => handleChange('title', val)}
            error={errors.title}
          />

          <Spacer size="small" />

          <Select
            label="Type"
            options={workOrderTypes}
            value={formData.type}
            onValueChange={(val) => handleChange('type', val)}
          />

          <Spacer size="small" />

          <Select
            label="Priority"
            options={priorities}
            value={formData.priority}
            onValueChange={(val) => handleChange('priority', val)}
          />

          <Spacer size="small" />

          <TextInput
            label="Estimated Cost"
            placeholder="$0.00"
            value={formData.estimatedCost}
            onChangeText={(val) => handleChange('estimatedCost', val)}
            keyboardType="decimal-pad"
          />

          <Spacer size="small" />

          <TextInput
            label="Due Date"
            placeholder="YYYY-MM-DD"
            value={formData.dueDate}
            onChangeText={(val) => handleChange('dueDate', val)}
            error={errors.dueDate}
          />

          <Spacer size="small" />

          <TextInput
            label="Description"
            placeholder="Additional details"
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
