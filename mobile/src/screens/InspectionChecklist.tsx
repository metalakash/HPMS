import React, { useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { ScreenContainer, Header, Card, CardBody, Checkbox, Button, Spacer, TextInput } from '@/components';

interface ChecklistItem {
  id: string;
  name: string;
  completed: boolean;
  notes: string;
}

export const InspectionChecklistScreen = ({ navigation, route }: any) => {
  const { formData, photos } = route.params;
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([
    { id: '1', name: 'Structure integrity', completed: false, notes: '' },
    { id: '2', name: 'Equipment condition', completed: false, notes: '' },
    { id: '3', name: 'Safety measures', completed: false, notes: '' },
    { id: '4', name: 'Maintenance records', completed: false, notes: '' },
    { id: '5', name: 'Compliance status', completed: false, notes: '' },
  ]);

  const handleToggleItem = (id: string) => {
    setChecklistItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const handleUpdateNotes = (id: string, notes: string) => {
    setChecklistItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, notes } : item
      )
    );
  };

  const completedCount = checklistItems.filter((item) => item.completed).length;

  const handleNext = () => {
    navigation.navigate('InspectionSignature', {
      formData,
      photos,
      checklist: checklistItems,
    });
  };

  return (
    <ScreenContainer scrollable={false}>
      <Header title={`Checklist (${completedCount}/${checklistItems.length})`} />

      <FlatList
        testID="checklist-items"
        data={checklistItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card>
            <CardBody>
              <Checkbox
                label={item.name}
                checked={item.completed}
                onToggle={() => handleToggleItem(item.id)}
              />
              <Spacer size="small" />
              <TextInput
                placeholder="Add notes..."
                value={item.notes}
                onChangeText={(notes) => handleUpdateNotes(item.id, notes)}
                multiline
                numberOfLines={2}
              />
            </CardBody>
          </Card>
        )}
      />

      <View style={styles.buttonContainer}>
        <Button
          title="Back"
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

      <Spacer size="medium" />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
  },
  button: {
    flex: 1,
  },
});
