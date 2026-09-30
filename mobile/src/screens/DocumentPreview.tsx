import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { ScreenContainer, Header, Card, CardBody, Button, Spacer, LoadingOverlay } from '@/components';

export const DocumentPreviewScreen = ({ route, navigation }: any) => {
  const { id } = route.params;
  const [loading, setLoading] = useState(true);

  // Mock document data
  const document = {
    id,
    title: 'Annual Inspection Report',
    fileName: 'inspection-2026.pdf',
    fileType: 'PDF',
    fileSize: 2048000,
    category: 'inspection',
    uploadedBy: 'John Doe',
    uploadedAt: '2026-09-27',
    url: 'https://example.com/documents/inspection-2026.pdf',
  };

  const handleDownload = async () => {
    setLoading(true);
    try {
      // Download logic would go here
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    // Share logic would go here
  };

  return (
    <ScreenContainer scrollable>
      <Header title={document.title} />
      <LoadingOverlay visible={loading} />

      <Spacer size="medium" />

      {/* Document Preview Area */}
      <Card>
        <CardBody>
          <View style={styles.previewArea}>
            {/* PDF/Image preview would render here */}
            <View style={styles.previewPlaceholder}>
              {document.fileType} Preview
            </View>
          </View>
        </CardBody>
      </Card>

      <Spacer size="small" />

      {/* Document Info */}
      <Card>
        <CardBody>
          <View style={styles.infoRow}>
            <View style={styles.label}>File:</View>
            <View style={styles.value}>{document.fileName}</View>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.label}>Size:</View>
            <View style={styles.value}>{(document.fileSize / 1024 / 1024).toFixed(2)}MB</View>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.label}>Uploaded:</View>
            <View style={styles.value}>{document.uploadedAt}</View>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.label}>By:</View>
            <View style={styles.value}>{document.uploadedBy}</View>
          </View>
        </CardBody>
      </Card>

      <Spacer size="medium" />

      <View style={styles.buttonContainer}>
        <Button
          title="Download"
          onPress={handleDownload}
          style={styles.button}
        />
        <Button
          title="Share"
          onPress={handleShare}
          variant="secondary"
          style={styles.button}
        />
      </View>

      <Spacer size="large" />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  previewArea: {
    height: 300,
    backgroundColor: '#F5F5F5',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewPlaceholder: {
    fontSize: 14,
    color: '#999',
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  label: {
    flex: 1,
    fontWeight: '600',
  },
  value: {
    flex: 2,
    color: '#666',
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
