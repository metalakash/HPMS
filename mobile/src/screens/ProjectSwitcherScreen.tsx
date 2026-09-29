/**
 * Project Switcher Screen
 * Project selection and navigation screen
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';

interface Project {
  id: string;
  name: string;
  status: 'active' | 'archived' | 'draft';
  ownerId: string;
  ownerEmail: string;
  members: any[];
  createdAt: string;
  updatedAt: string;
}

export const ProjectSwitcherScreen: React.FC = () => {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sharedProjects, setSharedProjects] = useState<Project[]>([]);
  const [searchText, setSearchText] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'archived'>('active');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'members'>('name');
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    myProjects: true,
    sharedProjects: true,
    archivedProjects: false,
  });

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      // Simulate API call
      const mockCurrent: Project = {
        id: 'proj-1',
        name: 'Hydropower Station Alpha',
        status: 'active',
        ownerId: 'user-1',
        ownerEmail: 'akash@example.com',
        members: [
          { userId: 'user-1', email: 'akash@example.com', role: 'owner' },
          { userId: 'user-2', email: 'john@example.com', role: 'member' },
        ],
        createdAt: '2026-08-01T00:00:00Z',
        updatedAt: '2026-09-29T12:30:00Z',
      };

      const mockProjects: Project[] = [
        mockCurrent,
        {
          id: 'proj-2',
          name: 'Hydropower Station Beta',
          status: 'active',
          ownerId: 'user-2',
          ownerEmail: 'john@example.com',
          members: [
            { userId: 'user-2', email: 'john@example.com', role: 'owner' },
            { userId: 'user-1', email: 'akash@example.com', role: 'member' },
          ],
          createdAt: '2026-07-15T00:00:00Z',
          updatedAt: '2026-09-28T10:00:00Z',
        },
        {
          id: 'proj-3',
          name: 'Pumped Storage Project',
          status: 'active',
          ownerId: 'user-1',
          ownerEmail: 'akash@example.com',
          members: [
            { userId: 'user-1', email: 'akash@example.com', role: 'owner' },
          ],
          createdAt: '2026-09-01T00:00:00Z',
          updatedAt: '2026-09-25T14:45:00Z',
        },
      ];

      const mockShared: Project[] = [
        {
          id: 'proj-4',
          name: 'Tidal Energy Facility',
          status: 'active',
          ownerId: 'user-3',
          ownerEmail: 'sarah@example.com',
          members: [
            { userId: 'user-3', email: 'sarah@example.com', role: 'owner' },
            { userId: 'user-1', email: 'akash@example.com', role: 'viewer' },
          ],
          createdAt: '2026-06-01T00:00:00Z',
          updatedAt: '2026-09-29T09:15:00Z',
        },
      ];

      setCurrentProject(mockCurrent);
      setProjects(mockProjects);
      setSharedProjects(mockShared);
    } catch (error) {
      console.error('Error loading projects:', error);
      Alert.alert('Error', 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  const switchProject = useCallback((project: Project) => {
    setCurrentProject(project);
    Alert.alert('Success', `Switched to ${project.name}`);
  }, []);

  const filterAndSortProjects = (projectList: Project[]): Project[] => {
    let filtered = projectList.filter(p => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchText.toLowerCase()) ||
        p.ownerEmail.toLowerCase().includes(searchText.toLowerCase());
      const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
      return matchesSearch && matchesStatus;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'date':
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        case 'members':
          return b.members.length - a.members.length;
        default:
          return 0;
      }
    });

    return filtered;
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

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const renderProjectRow = (project: Project, isCurrent: boolean = false) => (
    <TouchableOpacity
      key={project.id}
      style={[styles.projectRow, isCurrent && styles.projectRowCurrent]}
      onPress={() => switchProject(project)}
      testID={`project-row-${project.id}`}
    >
      <View style={styles.projectRowContent}>
        <View style={styles.projectHeader}>
          <Text style={[styles.projectName, isCurrent && styles.projectNameCurrent]}>
            {project.name}
          </Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(project.status) },
            ]}
          >
            <Text style={styles.statusText}>{project.status.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.projectOwner}>by {project.ownerEmail}</Text>

        <View style={styles.projectMeta}>
          <Text style={styles.metaText}>
            👥 {project.members.length} member{project.members.length !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.metaText}>
            📅 {formatDate(project.updatedAt)}
          </Text>
        </View>
      </View>

      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      </View>
    );
  }

  const filteredMyProjects = filterAndSortProjects(projects);
  const filteredShared = filterAndSortProjects(sharedProjects);
  const archivedProjects = projects.filter(p => p.status === 'archived');

  return (
    <View style={styles.container} testID="project-switcher-screen">
      <ScrollView style={styles.content}>
        {/* Current Project Display */}
        {currentProject && (
          <View style={styles.currentProjectSection}>
            <Text style={styles.sectionTitle}>Current Project</Text>
            <View style={styles.currentProjectCard}>
              <Text style={styles.currentProjectName}>{currentProject.name}</Text>
              <View
                style={[
                  styles.statusBadgeLarge,
                  { backgroundColor: getStatusColor(currentProject.status) },
                ]}
              >
                <Text style={styles.statusText}>
                  {currentProject.status.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.currentProjectOwner}>
                Owner: {currentProject.ownerEmail}
              </Text>
              <Text style={styles.currentProjectMembers}>
                Team size: {currentProject.members.length}
              </Text>
            </View>
          </View>
        )}

        {/* Search & Filter Bar */}
        <View style={styles.searchFilterSection}>
          <TextInput
            style={styles.searchBox}
            placeholder="Search projects..."
            value={searchText}
            onChangeText={setSearchText}
            testID="search-projects"
          />

          <View style={styles.filterRow}>
            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>Status:</Text>
              <Picker
                selectedValue={filterStatus}
                style={styles.picker}
                onValueChange={setFilterStatus}
                testID="filter-status"
              >
                <Picker.Item label="All" value="all" />
                <Picker.Item label="Active" value="active" />
                <Picker.Item label="Archived" value="archived" />
              </Picker>
            </View>

            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>Sort:</Text>
              <Picker
                selectedValue={sortBy}
                style={styles.picker}
                onValueChange={value => setSortBy(value as any)}
                testID="sort-by"
              >
                <Picker.Item label="Name" value="name" />
                <Picker.Item label="Date" value="date" />
                <Picker.Item label="Members" value="members" />
              </Picker>
            </View>
          </View>
        </View>

        {/* Project Stats */}
        <View style={styles.statsSection}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{projects.length}</Text>
            <Text style={styles.statLabel}>Total Projects</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {projects.filter(p => p.status === 'active').length}
            </Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{sharedProjects.length}</Text>
            <Text style={styles.statLabel}>Shared</Text>
          </View>
        </View>

        {/* My Projects */}
        {filteredMyProjects.length > 0 && (
          <View style={styles.projectsSection}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() =>
                setExpandedSections(prev => ({
                  ...prev,
                  myProjects: !prev.myProjects,
                }))
              }
              testID="my-projects-header"
            >
              <Text style={styles.sectionTitle}>
                {expandedSections.myProjects ? '▼' : '▶'} My Projects (
                {filteredMyProjects.length})
              </Text>
            </TouchableOpacity>

            {expandedSections.myProjects && (
              <View style={styles.projectsList}>
                {filteredMyProjects.map(project =>
                  renderProjectRow(
                    project,
                    currentProject?.id === project.id
                  )
                )}
              </View>
            )}
          </View>
        )}

        {/* Shared Projects */}
        {filteredShared.length > 0 && (
          <View style={styles.projectsSection}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() =>
                setExpandedSections(prev => ({
                  ...prev,
                  sharedProjects: !prev.sharedProjects,
                }))
              }
              testID="shared-projects-header"
            >
              <Text style={styles.sectionTitle}>
                {expandedSections.sharedProjects ? '▼' : '▶'} Shared With Me (
                {filteredShared.length})
              </Text>
            </TouchableOpacity>

            {expandedSections.sharedProjects && (
              <View style={styles.projectsList}>
                {filteredShared.map(project =>
                  renderProjectRow(
                    project,
                    currentProject?.id === project.id
                  )
                )}
              </View>
            )}
          </View>
        )}

        {/* Archived Projects */}
        {archivedProjects.length > 0 && (
          <View style={styles.projectsSection}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() =>
                setExpandedSections(prev => ({
                  ...prev,
                  archivedProjects: !prev.archivedProjects,
                }))
              }
              testID="archived-projects-header"
            >
              <Text style={styles.sectionTitle}>
                {expandedSections.archivedProjects ? '▼' : '▶'} Archived (
                {archivedProjects.length})
              </Text>
            </TouchableOpacity>

            {expandedSections.archivedProjects && (
              <View style={styles.projectsList}>
                {archivedProjects.map(project => renderProjectRow(project))}
              </View>
            )}
          </View>
        )}

        {/* Empty State */}
        {filteredMyProjects.length === 0 &&
          filteredShared.length === 0 &&
          archivedProjects.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No projects found</Text>
            </View>
          )}

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity style={styles.actionButton} testID="new-project-button">
            <Text style={styles.actionButtonText}>+ New Project</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  content: {
    flex: 1,
    padding: 12,
  },
  currentProjectSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  currentProjectCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  currentProjectName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  statusBadgeLarge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  currentProjectOwner: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  currentProjectMembers: {
    fontSize: 13,
    color: '#666',
  },
  searchFilterSection: {
    marginBottom: 16,
  },
  searchBox: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterItem: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  picker: {
    height: 36,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  statsSection: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  projectsSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    paddingVertical: 8,
  },
  projectsList: {
    gap: 8,
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#e0e0e0',
  },
  projectRowCurrent: {
    borderLeftColor: '#2196F3',
    backgroundColor: '#f0f7ff',
  },
  projectRowContent: {
    flex: 1,
  },
  projectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  projectName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  projectNameCurrent: {
    color: '#2196F3',
  },
  projectOwner: {
    fontSize: 12,
    color: '#999',
    marginBottom: 6,
  },
  projectMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  metaText: {
    fontSize: 11,
    color: '#666',
  },
  chevron: {
    fontSize: 20,
    color: '#ccc',
    marginLeft: 8,
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
  },
  actionsSection: {
    paddingVertical: 16,
    gap: 8,
  },
  actionButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
