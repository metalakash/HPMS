/**
 * Breach Management - Handle covenant breaches and corrective actions
 */

import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, FlatList, Text, Alert } from 'react-native';
import { ScreenContainer, Header, Card, CardBody, Badge, Spacer, Button } from '@/components';

interface BreachItem {
  id: string;
  covenant: string;
  startDate: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'under_review' | 'cured' | 'waived';
  reason: string;
  daysActive: number;
  actions: number;
}

interface CorrectiveAction {
  id: string;
  breachId: string;
  description: string;
  dueDate: string;
  status: 'planned' | 'in_progress' | 'completed';
  assignee: string;
}

export const BreachManagementScreen = ({ navigation }: any) => {
  const [selectedBreach, setSelectedBreach] = useState<string | null>(null);

  const [breaches] = useState<BreachItem[]>([
    {
      id: '1',
      covenant: 'Water Flow Rate',
      startDate: '2026-09-10',
      severity: 'high',
      status: 'active',
      reason: 'Seasonal water shortage reducing flow to 420 cubic meters/sec (threshold: 500)',
      daysActive: 17,
      actions: 2,
    },
    {
      id: '2',
      covenant: 'Annual Report Filing',
      startDate: '2026-08-15',
      severity: 'medium',
      status: 'under_review',
      reason: 'Report delayed due to audit process',
      daysActive: 43,
      actions: 3,
    },
    {
      id: '3',
      covenant: 'Current Ratio',
      startDate: '2026-06-20',
      severity: 'low',
      status: 'cured',
      reason: 'Temporary cash flow issue',
      daysActive: 90,
      actions: 4,
    },
  ]);

  const [actions] = useState<CorrectiveAction[]>([
    {
      id: '1',
      breachId: '1',
      description: 'Reduce output scheduling during low-flow season',
      dueDate: '2026-10-01',
      status: 'in_progress',
      assignee: 'Operations Manager',
    },
    {
      id: '2',
      breachId: '1',
      description: 'Submit variance request to lender',
      dueDate: '2026-09-30',
      status: 'planned',
      assignee: 'Finance Director',
    },
    {
      id: '3',
      breachId: '2',
      description: 'Complete financial audit',
      dueDate: '2026-10-15',
      status: 'in_progress',
      assignee: 'CFO',
    },
  ]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#F44336';
      case 'high':
        return '#FF5722';
      case 'medium':
        return '#FF9800';
      case 'low':
        return '#FFC107';
      default:
        return '#999';
    }
  };

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'danger';
      case 'high':
        return 'danger';
      case 'medium':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'danger';
      case 'under_review':
        return 'warning';
      case 'cured':
        return 'success';
      case 'waived':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getActionStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'in_progress':
        return '#2196F3';
      case 'planned':
        return '#FFC107';
      default:
        return '#999';
    }
  };

  const handleEscalate = (breachId: string) => {
    Alert.alert('Escalate Breach', 'Send notification to lender about breach?', [
      { text: 'Cancel', onPress: () => {} },
      { text: 'Send', onPress: () => Alert.alert('Sent', 'Lender notified') },
    ]);
  };

  const selectedBreachData = breaches.find(b => b.id === selectedBreach);
  const breachActions = selectedBreach
    ? actions.filter(a => a.breachId === selectedBreach)
    : [];

  return (
    <ScreenContainer>
      <Header title="Breach Management" onBack={() => navigation.goBack()} />
      <Spacer size="small" />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Breach Summary */}
        <Text style={styles.sectionTitle}>Active Breaches ({breaches.filter(b => b.status === 'active').length})</Text>
        <FlatList
          data={breaches}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <Card
              onPress={() => setSelectedBreach(item.id)}
              style={[
                styles.breachCard,
                selectedBreach === item.id && styles.selectedCard,
              ]}
            >
              <CardBody>
                <View style={styles.breachHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.covenantName}>{item.covenant}</Text>
                    <Text style={styles.breachDate}>
                      Started {item.startDate} • {item.daysActive} days active
                    </Text>
                  </View>
                  <Badge label={item.severity.toUpperCase()} variant={getSeverityVariant(item.severity)} />
                </View>

                <Text style={styles.breachReason}>{item.reason}</Text>

                <View style={styles.breachFooter}>
                  <Badge
                    label={item.status.replace('_', ' ')}
                    variant={getStatusVariant(item.status)}
                  />
                  <Text style={styles.actionCount}>
                    {item.actions} {item.actions === 1 ? 'action' : 'actions'}
                  </Text>
                </View>
              </CardBody>
            </Card>
          )}
        />

        {selectedBreach && selectedBreachData && (
          <>
            <Spacer size="large" />

            {/* Breach Details */}
            <Text style={styles.sectionTitle}>Breach Details</Text>
            <Card>
              <CardBody>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Covenant</Text>
                  <Text style={styles.detailValue}>{selectedBreachData.covenant}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Start Date</Text>
                  <Text style={styles.detailValue}>{selectedBreachData.startDate}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <Badge
                    label={selectedBreachData.status.replace('_', ' ')}
                    variant={getStatusVariant(selectedBreachData.status)}
                  />
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Severity</Text>
                  <Badge
                    label={selectedBreachData.severity.toUpperCase()}
                    variant={getSeverityVariant(selectedBreachData.severity)}
                  />
                </View>
              </CardBody>
            </Card>

            <Spacer size="large" />

            {/* Corrective Actions */}
            <Text style={styles.sectionTitle}>
              Corrective Actions ({breachActions.length})
            </Text>
            {breachActions.length === 0 ? (
              <Card>
                <CardBody>
                  <Text style={styles.emptyText}>No actions planned</Text>
                </CardBody>
              </Card>
            ) : (
              <FlatList
                data={breachActions}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <Card style={styles.actionCard}>
                    <CardBody>
                      <Text style={styles.actionDescription}>{item.description}</Text>
                      <View style={styles.actionRow}>
                        <View style={styles.actionInfo}>
                          <Text style={styles.actionLabel}>Due: {item.dueDate}</Text>
                          <Text style={styles.actionAssignee}>👤 {item.assignee}</Text>
                        </View>
                        <Badge
                          label={item.status.replace('_', ' ')}
                          variant={
                            item.status === 'completed'
                              ? 'success'
                              : item.status === 'in_progress'
                              ? 'warning'
                              : 'secondary'
                          }
                        />
                      </View>

                      {/* Progress indicator */}
                      <View
                        style={[
                          styles.statusIndicator,
                          { backgroundColor: getActionStatusColor(item.status) },
                        ]}
                      />
                    </CardBody>
                  </Card>
                )}
              />
            )}

            <Spacer size="large" />

            {/* Action Buttons */}
            <Text style={styles.sectionTitle}>Actions</Text>
            <View style={styles.buttonContainer}>
              <Button
                title="Add Action"
                onPress={() => Alert.alert('Add', 'Add new corrective action')}
                variant="primary"
                size="small"
                style={styles.button}
              />
              <Button
                title="Escalate"
                onPress={() => handleEscalate(selectedBreach)}
                variant="secondary"
                size="small"
                style={styles.button}
              />
            </View>

            <Spacer size="large" />
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  breachCard: {
    marginHorizontal: 12,
    marginVertical: 4,
  },
  selectedCard: {
    backgroundColor: '#e3f2fd',
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  breachHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  covenantName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  breachDate: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  breachReason: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
    marginVertical: 8,
  },
  breachFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  actionCount: {
    fontSize: 11,
    color: '#999',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  detailLabel: {
    fontSize: 12,
    color: '#999',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  actionCard: {
    marginHorizontal: 12,
    marginVertical: 4,
  },
  actionDescription: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionInfo: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 11,
    color: '#999',
  },
  actionAssignee: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  statusIndicator: {
    height: 3,
    borderRadius: 1.5,
  },
  emptyText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
  },
  button: {
    flex: 1,
  },
});
