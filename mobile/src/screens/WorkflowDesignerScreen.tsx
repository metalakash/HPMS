/**
 * Workflow Designer Screen
 * Design and customize cross-feature workflows
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Alert,
  Modal,
  TextInput,
} from 'react-native';

interface WorkflowStep {
  id: string;
  order: number;
  action: string;
  feature: string;
  condition?: string;
}

interface Workflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  isPublished: boolean;
  createdAt: string;
}

export const WorkflowDesignerScreen: React.FC<{ workflowId?: string }> = ({ workflowId }) => {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [workflowName, setWorkflowName] = useState('');
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [showAddStep, setShowAddStep] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

  const actionOptions = [
    { label: 'Create Inspection', value: 'create_inspection' },
    { label: 'Create Work Order', value: 'create_workorder' },
    { label: 'Create Compliance Check', value: 'create_compliance' },
    { label: 'Send Notification', value: 'notify' },
    { label: 'Assign to Team', value: 'assign' },
  ];

  useEffect(() => {
    if (workflowId) {
      loadWorkflow();
    }
  }, [workflowId]);

  const loadWorkflow = useCallback(async () => {
    setLoading(true);
    try {
      const mockWorkflow: Workflow = {
        id: workflowId || 'wf-1',
        name: 'Standard Defect Workflow',
        steps: [
          {
            id: 'step-1',
            order: 1,
            action: 'create_inspection',
            feature: 'inspections',
            condition: 'Inspection severity >= Medium',
          },
          {
            id: 'step-2',
            order: 2,
            action: 'create_workorder',
            feature: 'workorders',
            condition: 'If issues found',
          },
          {
            id: 'step-3',
            order: 3,
            action: 'assign',
            feature: 'workorders',
            condition: 'Auto-assign to team lead',
          },
          {
            id: 'step-4',
            order: 4,
            action: 'create_compliance',
            feature: 'compliance',
            condition: 'Work order completed',
          },
        ],
        isPublished: true,
        createdAt: new Date().toISOString(),
      };

      setWorkflow(mockWorkflow);
      setWorkflowName(mockWorkflow.name);
      setSteps(mockWorkflow.steps);
      setIsPublished(mockWorkflow.isPublished);
    } catch (error) {
      console.error('Error loading workflow:', error);
      Alert.alert('Error', 'Failed to load workflow');
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  const addStep = (action: string, feature: string) => {
    const newStep: WorkflowStep = {
      id: `step-${Date.now()}`,
      order: steps.length + 1,
      action,
      feature,
    };
    setSteps([...steps, newStep]);
    setShowAddStep(false);
  };

  const removeStep = (stepId: string) => {
    setSteps(steps.filter(s => s.id !== stepId));
  };

  const reorderSteps = (fromIndex: number, toIndex: number) => {
    const newSteps = [...steps];
    const [removed] = newSteps.splice(fromIndex, 1);
    newSteps.splice(toIndex, 0, removed);
    setSteps(newSteps.map((s, idx) => ({ ...s, order: idx + 1 })));
  };

  const saveWorkflow = async () => {
    if (!workflowName.trim()) {
      Alert.alert('Error', 'Please enter a workflow name');
      return;
    }
    if (steps.length === 0) {
      Alert.alert('Error', 'Please add at least one step');
      return;
    }

    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      Alert.alert('Success', 'Workflow saved successfully');
      setWorkflow({
        id: workflowId || `wf-${Date.now()}`,
        name: workflowName,
        steps,
        isPublished: false,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to save workflow');
    } finally {
      setLoading(false);
    }
  };

  const publishWorkflow = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsPublished(true);
      Alert.alert('Success', 'Workflow published successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to publish workflow');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = ({ item, index }: { item: WorkflowStep; index: number }) => {
    const action = actionOptions.find(a => a.value === item.action);
    return (
      <View style={styles.stepRow} testID={`workflow-step-${item.id}`}>
        <View style={styles.stepNumber}>
          <Text style={styles.stepNumberText}>{index + 1}</Text>
        </View>
        <View style={styles.stepContent}>
          <Text style={styles.stepAction}>{action?.label}</Text>
          <Text style={styles.stepFeature}>{item.feature}</Text>
          {item.condition && <Text style={styles.stepCondition}>If: {item.condition}</Text>}
        </View>
        <TouchableOpacity
          style={styles.removeStepButton}
          onPress={() => removeStep(item.id)}
          testID={`remove-step-${item.id}`}
        >
          <Text style={styles.removeText}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading && !workflow) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="workflow-designer-screen">
      <ScrollView style={styles.content}>
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.screenTitle}>Workflow Designer</Text>
        </View>

        {/* Workflow Name Input */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>Workflow Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter workflow name"
            value={workflowName}
            onChangeText={setWorkflowName}
            testID="workflow-name-input"
          />
        </View>

        {/* Workflow Steps */}
        <View style={styles.stepsSection}>
          <View style={styles.stepsHeader}>
            <Text style={styles.sectionLabel}>Workflow Steps ({steps.length})</Text>
            <TouchableOpacity
              style={styles.addStepButton}
              onPress={() => setShowAddStep(true)}
              testID="add-step-button"
            >
              <Text style={styles.addStepText}>+ Add Step</Text>
            </TouchableOpacity>
          </View>

          {steps.length > 0 ? (
            <FlatList
              data={steps}
              renderItem={renderStep}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              testID="workflow-steps-list"
            />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No steps yet. Add the first step to begin.</Text>
            </View>
          )}
        </View>

        {/* Trigger Configuration */}
        <View style={styles.configSection}>
          <Text style={styles.sectionLabel}>Trigger Configuration</Text>
          <View style={styles.configCard}>
            <View style={styles.configRow}>
              <Text style={styles.configLabel}>Trigger Type:</Text>
              <Text style={styles.configValue}>Manual / Automatic</Text>
            </View>
            <View style={styles.configRow}>
              <Text style={styles.configLabel}>On:</Text>
              <Text style={styles.configValue}>Creation / Status Change</Text>
            </View>
            <View style={styles.configRow}>
              <Text style={styles.configLabel}>Delay:</Text>
              <Text style={styles.configValue}>Immediate</Text>
            </View>
          </View>
        </View>

        {/* Preview Section */}
        <View style={styles.previewSection}>
          <Text style={styles.sectionLabel}>Workflow Preview</Text>
          <TouchableOpacity
            style={styles.previewButton}
            onPress={() => setShowPreview(true)}
            testID="preview-workflow"
          >
            <Text style={styles.previewButtonText}>👁 Preview Workflow</Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={saveWorkflow}
            testID="save-workflow"
            disabled={loading}
          >
            <Text style={styles.saveButtonText}>💾 Save Workflow</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.publishButton, isPublished && styles.publishButtonActive]}
            onPress={publishWorkflow}
            testID="publish-workflow"
            disabled={loading}
          >
            <Text
              style={[
                styles.publishButtonText,
                isPublished && styles.publishButtonTextActive,
              ]}
            >
              {isPublished ? '✓ Published' : '📢 Publish'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Add Step Modal */}
      <Modal visible={showAddStep} transparent animationType="slide" testID="add-step-modal">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Workflow Step</Text>
              <TouchableOpacity onPress={() => setShowAddStep(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalLabel}>Select Action</Text>
              {actionOptions.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.optionButton}
                  onPress={() => addStep(option.value, 'general')}
                  testID={`action-${option.value}`}
                >
                  <Text style={styles.optionText}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Preview Modal */}
      <Modal visible={showPreview} transparent animationType="fade" testID="preview-modal">
        <View style={styles.modalOverlay}>
          <View style={styles.previewModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Workflow Preview</Text>
              <TouchableOpacity onPress={() => setShowPreview(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.previewText}>
                This workflow will execute the following steps in order:
              </Text>
              {steps.map((step, idx) => (
                <View key={step.id} style={styles.previewStep}>
                  <Text style={styles.previewStepNumber}>Step {idx + 1}</Text>
                  <Text style={styles.previewStepAction}>
                    {actionOptions.find(a => a.value === step.action)?.label}
                  </Text>
                  {step.condition && (
                    <Text style={styles.previewCondition}>Condition: {step.condition}</Text>
                  )}
                </View>
              ))}
            </ScrollView>
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
  content: {
    flex: 1,
    padding: 12,
  },
  headerSection: {
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  inputSection: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#333',
  },
  stepsSection: {
    marginBottom: 16,
  },
  stepsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  addStepButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  addStepText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  stepContent: {
    flex: 1,
  },
  stepAction: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 3,
  },
  stepFeature: {
    fontSize: 11,
    color: '#999',
  },
  stepCondition: {
    fontSize: 10,
    color: '#FF9800',
    marginTop: 3,
    fontStyle: 'italic',
  },
  removeStepButton: {
    padding: 8,
  },
  removeText: {
    color: '#f44336',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#999',
  },
  configSection: {
    marginBottom: 16,
  },
  configCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  configLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  configValue: {
    fontSize: 12,
    color: '#333',
  },
  previewSection: {
    marginBottom: 16,
  },
  previewButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  previewButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2196F3',
  },
  actionsSection: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  publishButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  publishButtonActive: {
    backgroundColor: '#FF9800',
    borderColor: '#FF9800',
  },
  publishButtonText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '600',
  },
  publishButtonTextActive: {
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: '80%',
  },
  previewModalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    fontSize: 20,
    color: '#999',
  },
  modalBody: {
    padding: 16,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
  },
  optionButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  optionText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  previewText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  previewStep: {
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  previewStepNumber: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
  },
  previewStepAction: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginTop: 4,
  },
  previewCondition: {
    fontSize: 11,
    color: '#FF9800',
    marginTop: 4,
    fontStyle: 'italic',
  },
});
