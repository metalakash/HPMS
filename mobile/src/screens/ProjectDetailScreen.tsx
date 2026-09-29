/**
 * Project Detail Screen
 * Detailed project view with members and settings
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  TextInput,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';

interface TeamMember {
  userId: string;
  email: string;
  name: string;
  role: 'owner' | 'member' | 'viewer';
  joinedAt: string;
}

interface Project {
  id: string;
  name: string;
  status: 'active' | 'archived' | 'draft';
  ownerId: string;
  ownerEmail: string;
  members: TeamMember[];
  createdAt: string;
  updatedAt: string;
  description?: string;
}

interface ProjectDetailScreenProps {
  projectId: string;
  onBack: () => void;
}

export const ProjectDetailScreen: React.FC<ProjectDetailScreenProps> = ({
  projectId,
  onBack,
}) => {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'member' | 'viewer'>('member');

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const loadProject = useCallback(async () => {
    setLoading(true);
    try {
      // Simulate API call
      const mockProject: Project = {
        id: projectId,
        name: 'Hydropower Station Alpha',
        status: 'active',
        ownerId: 'user-1',
        ownerEmail: 'akash@example.com',
        description: 'Main hydropower facility with 5 turbines',
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-09-29T12:30:00Z',
        members: [
          {
            userId: 'user-1',
            email: 'akash@example.com',
            name: 'Akash Rai',
            role: 'owner',
            joinedAt: '2026-08-01T00:00:00Z',
          },
          {
            userId: 'user-2',
            email: 'john@example.com',
            name: 'John Smith',
            role: 'member',
            joinedAt: '2026-08-15T00:00:00Z',
          },
          {
            userId: 'user-3',
            email: 'sarah@example.com',
            name: 'Sarah Johnson',
            role: 'viewer',
            joinedAt: '2026-09-01T00:00:00Z',
          },
        ],
      };

      setProject(mockProject);
    } catch (error) {
      console.error('Error loading project:', error);
      Alert.alert('Error', 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const addMember = useCallback(() => {
    if (!newMemberEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    if (project) {
      const newMember: TeamMember = {
        userId: `user-${Date.now()}`,
        email: newMemberEmail,
        name: newMemberEmail.split('@')[0],
        role: newMemberRole,
        joinedAt: new Date().toISOString(),
      };

      setProject(prev =>
        prev ? { ...prev, members: [...prev.members, newMember] } : null
      );

      setNewMemberEmail('');
      setShowAddMemberModal(false);
      Alert.alert('Success', `Added ${newMemberEmail} as ${newMemberRole}`);
    }
  }, [newMemberEmail, newMemberRole, project]);

  const removeMember = useCallback((userId: string) => {
    Alert.alert('Remove Member', 'Are you sure you want to remove this member?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setProject(prev =>
            prev
              ? {
                  ...prev,
                  members: prev.members.filter(m => m.userId !== userId),
                }
              : null
          );
        },
      },
    ]);
  }, []);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const getRoleColor = (role: string): string => {
    switch (role) {
      case 'owner':
        return '#F44336';
      case 'member':
        return '#2196F3';
      case 'viewer':
        return '#999';
      default:
        return '#757575';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active':
        return '#4CAF50';
      case 'archived':
        return '#999';
      case 'draft':
        return '#FF9800';
      default:
        return '#757575';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      </View>
    );
  }

  if (!project) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.backButton}>‹ Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Project not found</Text>
        </View>
      </View>
    );
  }

  const isOwner = project.ownerId === 'user-1'; // Hardcoded for demo

  return (
    <View style={styles.container} testID="project-detail-screen">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} testID="back-button">
          <Text style={styles.backButton}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{project.name}</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Project Header */}
        <View style={styles.projectHeaderSection}>
          <Text style={styles.projectTitle}>{project.name}</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(project.status) },
            ]}
          >
            <Text style={styles.statusText}>{project.status.toUpperCase()}</Text>
          </View>
          <Text style={styles.projectId}>ID: {project.id}</Text>
          <Text style={styles.projectDates}>
            Created: {formatDate(project.createdAt)} | Updated:{' '}
            {formatDate(project.updatedAt)}
          </Text>
        </View>

        {/* Description */}
        {project.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.descriptionText}>{project.description}</Text>
          </View>
        )}

        {/* Project Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Project Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>45</Text>
              <Text style={styles.statLabel}>Records</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>28</Text>
              <Text style={styles.statLabel}>Inspections</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>12</Text>
              <Text style={styles.statLabel}>Work Orders</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>8</Text>
              <Text style={styles.statLabel}>Compliance</Text>
            </View>
          </View>
        </View>

        {/* Team Members */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Team Members ({project.members.length})</Text>
            {isOwner && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowAddMemberModal(true)}
                testID="add-member-button"
              >
                <Text style={styles.addButtonText}>+ Add</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.membersList}>
            {project.members.map(member => (
              <View key={member.userId} style={styles.memberRow} testID="member-row">
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text style={styles.memberEmail}>{member.email}</Text>
                  <Text style={styles.memberJoinedDate}>
                    Joined {formatDate(member.joinedAt)}
                  </Text>
                </View>

                <View style={styles.memberActionContainer}>
                  <View
                    style={[
                      styles.roleBadge,
                      { backgroundColor: getRoleColor(member.role) },
                    ]}
                  >
                    <Text style={styles.roleBadgeText}>{member.role}</Text>
                  </View>

                  {isOwner && member.userId !== 'user-1' && (
                    <TouchableOpacity
                      onPress={() => removeMember(member.userId)}
                      testID={`remove-member-${member.userId}`}
                    >
                      <Text style={styles.removeButton}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Project Actions */}
        {isOwner && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actions</Text>
            <TouchableOpacity style={styles.actionButton} testID="edit-project-button">
              <Text style={styles.actionButtonText}>✏️ Edit Project</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonWarning]}
              testID="archive-project-button"
            >
              <Text style={styles.actionButtonText}>📦 Archive Project</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonDanger]}
              testID="delete-project-button"
            >
              <Text style={styles.actionButtonText}>🗑️ Delete Project</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Add Member Modal */}
      <Modal visible={showAddMemberModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Team Member</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Email address"
              value={newMemberEmail}
              onChangeText={setNewMemberEmail}
              testID="add-member-email-input"
            />

            <View style={styles.roleSelector}>
              <Text style={styles.roleSelectorLabel}>Role</Text>
              <Picker
                selectedValue={newMemberRole}
                style={styles.rolePicker}
                onValueChange={setNewMemberRole}
                testID="add-member-role-picker"
              >
                <Picker.Item label="Member" value="member" />
                <Picker.Item label="Viewer" value="viewer" />
              </Picker>
            </View>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowAddMemberModal(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalAddButton}
                onPress={addMember}
                testID="add-member-confirm"
              >
                <Text style={styles.modalAddButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 16,
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 12,
  },
  projectHeaderSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  projectTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  projectId: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  projectDates: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  addButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  descriptionText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statBox: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  membersList: {
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  memberEmail: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  memberJoinedDate: {
    fontSize: 11,
    color: '#999',
  },
  memberActionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  removeButton: {
    fontSize: 16,
    color: '#f44336',
    fontWeight: 'bold',
  },
  actionButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  actionButtonWarning: {
    backgroundColor: '#FF9800',
  },
  actionButtonDanger: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  modalInput: {
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  roleSelector: {
    marginBottom: 16,
  },
  roleSelectorLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  rolePicker: {
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modalCancelButton: {
    flex: 1,
    borderRadius: 6,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  modalAddButton: {
    flex: 1,
    borderRadius: 6,
    paddingVertical: 10,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
  },
  modalAddButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
