import React, { useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { ScreenContainer, Header, Card, CardBody, TextInput, Checkbox, Button, Spacer } from '@/components';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  canEdit: boolean;
}

export const DocumentSharingScreen = ({ route, navigation }: any) => {
  const { documentId } = route.params;
  const [sharedWith, setSharedWith] = useState<string[]>([]);
  const [teamMembers] = useState<TeamMember[]>([
    { id: '1', name: 'John Doe', email: 'john@company.com', role: 'Engineer', canEdit: true },
    { id: '2', name: 'Jane Smith', email: 'jane@company.com', role: 'Manager', canEdit: false },
    { id: '3', name: 'Bob Johnson', email: 'bob@company.com', role: 'Technician', canEdit: true },
  ]);

  const toggleMember = (memberId: string) => {
    setSharedWith((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleShare = async () => {
    // Share logic would go here
    navigation.goBack();
  };

  return (
    <ScreenContainer scrollable={false}>
      <Header title="Share Document" />

      <Spacer size="medium" />

      <Card>
        <CardBody>
          <View style={styles.section}>
            <View style={styles.sectionTitle}>Share with Team</View>
            <FlatList
              testID="share-team-list"
              data={teamMembers}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.memberItem}>
                  <Checkbox
                    label={item.name}
                    checked={sharedWith.includes(item.id)}
                    onToggle={() => toggleMember(item.id)}
                  />
                  <View style={styles.memberDetails}>
                    {item.email}
                  </View>
                </View>
              )}
            />
          </View>

          <Spacer size="medium" />

          <View style={styles.permissionNote}>
            <View style={styles.noteText}>Can view and download</View>
          </View>

          <Spacer size="medium" />

          <View style={styles.buttonContainer}>
            <Button
              title="Cancel"
              onPress={() => navigation.goBack()}
              variant="secondary"
              style={styles.button}
            />
            <Button
              title="Share"
              onPress={handleShare}
              disabled={sharedWith.length === 0}
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
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  memberItem: {
    paddingVertical: 8,
  },
  memberDetails: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    marginLeft: 32,
  },
  permissionNote: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
  noteText: {
    fontSize: 12,
    color: '#1976D2',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
  },
});
