import React, { useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { ScreenContainer, Header, Card, CardBody, ListItem, Checkbox, Button, Spacer } from '@/components';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  expertise: string[];
  available: boolean;
}

export const AssignWorkOrderScreen = ({ navigation, route }: any) => {
  const { formData } = route.params;
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [teamMembers] = useState<TeamMember[]>([
    { id: '1', name: 'John Smith', role: 'Technician', expertise: ['Pumps', 'Motors'], available: true },
    { id: '2', name: 'Jane Doe', role: 'Engineer', expertise: ['Electrical', 'Mechanical'], available: true },
    { id: '3', name: 'Bob Johnson', role: 'Technician', expertise: ['Welding', 'Fabrication'], available: false },
  ]);

  const toggleMember = (memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleNext = () => {
    navigation.navigate('WorkOrderTimeline', {
      formData,
      assignedTeam: selectedMembers,
    });
  };

  return (
    <ScreenContainer scrollable={false}>
      <Header title="Assign Team" />

      <Card>
        <CardBody>
          <Spacer size="small" />
          <FlatList
            testID="team-members-list"
            data={teamMembers}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.memberItem}>
                <Checkbox
                  label={item.name}
                  checked={selectedMembers.includes(item.id)}
                  onToggle={() => toggleMember(item.id)}
                  disabled={!item.available}
                />
                <View style={styles.memberDetails}>
                  <View style={styles.memberInfo}>
                    {item.role}
                    {!item.available && ' (Unavailable)'}
                  </View>
                  <View style={styles.expertise}>
                    {item.expertise.map((exp) => (
                      <View key={exp} style={styles.expertiseBadge}>
                        {exp}
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}
          />
        </CardBody>
      </Card>

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
  memberItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  memberDetails: {
    marginTop: 8,
  },
  memberInfo: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  expertise: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  expertiseBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 11,
    color: '#1976D2',
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
