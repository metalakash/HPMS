import React from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Checkbox, TextInput, Card, CardBody, Spacer } from '@/components';

export interface ChecklistItem {
  id: string;
  name: string;
  completed: boolean;
  notes: string;
}

interface ChecklistBuilderProps {
  items: ChecklistItem[];
  onItemToggle: (id: string) => void;
  onNotesChange: (id: string, notes: string) => void;
  onAddItem?: () => void;
}

export const ChecklistBuilder = ({
  items,
  onItemToggle,
  onNotesChange,
  onAddItem,
}: ChecklistBuilderProps) => {
  return (
    <View style={styles.container}>
      <FlatList
        testID="checklist-builder"
        data={items}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <Card>
            <CardBody>
              <Checkbox
                label={item.name}
                checked={item.completed}
                onToggle={() => onItemToggle(item.id)}
              />
              <Spacer size="small" />
              <TextInput
                placeholder="Add notes..."
                value={item.notes}
                onChangeText={(notes) => onNotesChange(item.id, notes)}
                multiline
                numberOfLines={2}
              />
            </CardBody>
          </Card>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
