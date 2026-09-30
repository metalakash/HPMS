import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { ScreenContainer, Header, Card, CardBody, TextInput, Button, Spacer, LoadingOverlay } from '@/components';
import { apiService } from '@/services/api.service';

export const CompleteWorkOrderScreen = ({ navigation, route }: any) => {
  const { formData, assignedTeam, timeline } = route.params;
  const [actualCost, setActualCost] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    setLoading(true);
    try {
      const completionData = {
        ...formData,
        assignedTeam,
        actualCost: parseFloat(actualCost) || 0,
        completionNotes: notes,
        status: 'completed',
        completedAt: new Date().toISOString(),
      };

      await apiService.completeWorkOrder(completionData);
      navigation.navigate('Maintenance');
    } catch (error) {
      console.error('Failed to complete work order:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer scrollable>
      <Header title="Complete Work Order" />

      <LoadingOverlay visible={loading} />

      <Spacer size="medium" />

      <Card>
        <CardBody>
          <TextInput
            label="Actual Cost"
            placeholder="$0.00"
            value={actualCost}
            onChangeText={setActualCost}
            keyboardType="decimal-pad"
          />

          <Spacer size="small" />

          <TextInput
            label="Completion Notes"
            placeholder="What was completed? Any issues?"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={6}
          />

          <Spacer size="medium" />

          <View style={styles.buttonContainer}>
            <Button
              title="Save as Draft"
              onPress={() => navigation.goBack()}
              variant="secondary"
              style={styles.button}
            />
            <Button
              title="Mark Complete"
              onPress={handleComplete}
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
