import React, { useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { ScreenContainer, Header, Card, CardBody, ListItem, Badge, Button, Spacer } from '@/components';

interface TimelineEvent {
  id: string;
  date: string;
  status: string;
  description: string;
  by?: string;
}

export const WorkOrderTimelineScreen = ({ navigation, route }: any) => {
  const { formData, assignedTeam } = route.params;
  const [timeline] = useState<TimelineEvent[]>([
    { id: '1', date: 'Today', status: 'created', description: 'Work order created', by: 'You' },
    { id: '2', date: 'Today', status: 'assigned', description: 'Team assigned', by: 'System' },
  ]);

  const handleStart = () => {
    navigation.navigate('CompleteWorkOrder', {
      formData,
      assignedTeam,
      timeline,
    });
  };

  return (
    <ScreenContainer scrollable={false}>
      <Header title="Timeline & Status" />

      <Card>
        <CardBody>
          <FlatList
            testID="timeline-list"
            data={timeline}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.timelineItem}>
                <View style={styles.dot} />
                <View style={styles.content}>
                  <View style={styles.header}>
                    <Badge label={item.status} size="small" />
                    <View style={styles.date}>{item.date}</View>
                  </View>
                  <View style={styles.description}>{item.description}</View>
                  {item.by && <View style={styles.by}>by {item.by}</View>}
                </View>
              </View>
            )}
          />
        </CardBody>
      </Card>

      <Spacer size="medium" />

      <View style={styles.buttonContainer}>
        <Button
          title="Back"
          onPress={() => navigation.goBack()}
          variant="secondary"
          style={styles.button}
        />
        <Button
          title="Start Work"
          onPress={handleStart}
          style={styles.button}
        />
      </View>

      <Spacer size="medium" />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  timelineItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#1976D2',
    marginVertical: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1976D2',
    marginRight: 12,
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: '#999',
  },
  description: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  by: {
    fontSize: 12,
    color: '#999',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
  },
  button: {
    flex: 1,
  },
});
