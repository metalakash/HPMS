import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { ScreenContainer, Header, Card, CardBody, TextInput, Select, Button, Spacer, LoadingOverlay } from '@/components';

export const UploadDocumentScreen = ({ navigation }: any) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('other');
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSelectFile = async () => {
    // File picker implementation would go here
    setFile({ name: 'sample.pdf', size: 2048000 });
  };

  const handleUpload = async () => {
    if (!title || !file) {
      alert('Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      // Upload logic would go here
      navigation.goBack();
    } catch (error) {
      alert('Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { label: 'Permit', value: 'permit' },
    { label: 'Contract', value: 'contract' },
    { label: 'Inspection', value: 'inspection' },
    { label: 'Compliance', value: 'compliance' },
    { label: 'Other', value: 'other' },
  ];

  return (
    <ScreenContainer scrollable>
      <Header title="Upload Document" />
      <LoadingOverlay visible={loading} />

      <Spacer size="medium" />

      <Card>
        <CardBody>
          <TextInput
            label="Document Title"
            placeholder="e.g., Annual Inspection Report"
            value={title}
            onChangeText={setTitle}
          />

          <Spacer size="small" />

          <Select
            label="Category"
            options={categories}
            value={category}
            onValueChange={setCategory}
          />

          <Spacer size="medium" />

          <Button title="Select File" onPress={handleSelectFile} variant="secondary" />

          {file && (
            <>
              <Spacer size="small" />
              <View style={styles.fileInfo}>
                <View style={styles.fileName}>{file.name}</View>
                <View style={styles.fileSize}>{(file.size / 1024 / 1024).toFixed(2)}MB</View>
              </View>
            </>
          )}

          <Spacer size="medium" />

          <View style={styles.buttonContainer}>
            <Button
              title="Cancel"
              onPress={() => navigation.goBack()}
              variant="secondary"
              style={styles.button}
            />
            <Button
              title="Upload"
              onPress={handleUpload}
              loading={loading}
              disabled={!title || !file}
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
  fileInfo: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 4,
  },
  fileName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  fileSize: {
    fontSize: 12,
    color: '#999',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
  },
});
