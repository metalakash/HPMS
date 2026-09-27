import React from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Select, Card, CardBody, Spacer } from '@/components';

interface WorkOrderFormProps {
  type: string;
  priority: string;
  title: string;
  description: string;
  estimatedCost: string;
  dueDate: string;
  onTypeChange: (type: string) => void;
  onPriorityChange: (priority: string) => void;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onCostChange: (cost: string) => void;
  onDueDateChange: (date: string) => void;
  errors?: Record<string, string>;
}

export const WorkOrderForm = ({
  type,
  priority,
  title,
  description,
  estimatedCost,
  dueDate,
  onTypeChange,
  onPriorityChange,
  onTitleChange,
  onDescriptionChange,
  onCostChange,
  onDueDateChange,
  errors = {},
}: WorkOrderFormProps) => {
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
    <Card>
      <CardBody>
        <TextInput
          label="Title"
          placeholder="e.g., Pump maintenance"
          value={title}
          onChangeText={onTitleChange}
          error={errors.title}
        />

        <Spacer size="small" />

        <Select
          label="Type"
          options={workOrderTypes}
          value={type}
          onValueChange={onTypeChange}
        />

        <Spacer size="small" />

        <Select
          label="Priority"
          options={priorities}
          value={priority}
          onValueChange={onPriorityChange}
        />

        <Spacer size="small" />

        <TextInput
          label="Estimated Cost"
          placeholder="$0.00"
          value={estimatedCost}
          onChangeText={onCostChange}
          keyboardType="decimal-pad"
        />

        <Spacer size="small" />

        <TextInput
          label="Due Date"
          placeholder="YYYY-MM-DD"
          value={dueDate}
          onChangeText={onDueDateChange}
          error={errors.dueDate}
        />

        <Spacer size="small" />

        <TextInput
          label="Description"
          placeholder="Additional details"
          value={description}
          onChangeText={onDescriptionChange}
          multiline
          numberOfLines={4}
        />
      </CardBody>
    </Card>
  );
};
