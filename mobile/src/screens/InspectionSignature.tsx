import React, { useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { ScreenContainer, Header, Card, CardHeader, CardBody, TextInput, Button, Spacer } from '@/components';

export const InspectionSignatureScreen = ({ navigation, route }: any) => {
  const { formData, photos, checklist } = route.params;
  const signatureRef = useRef<any>(null);
  const [signatureData, setSignatureData] = React.useState<string | null>(null);
  const [inspectorName, setInspectorName] = React.useState('');

  const handleClearSignature = () => {
    signatureRef.current?.clearSignature();
    setSignatureData(null);
  };

  const handleSaveSignature = () => {
    signatureRef.current?.readSignature();
  };

  const handleNext = () => {
    if (!inspectorName || !signatureData) {
      alert('Please enter name and signature');
      return;
    }

    navigation.navigate('InspectionReview', {
      formData,
      photos,
      checklist,
      signature: {
        inspectorName,
        data: signatureData,
        timestamp: new Date().toISOString(),
      },
    });
  };

  return (
    <ScreenContainer scrollable>
      <Header title="Signature" />

      <Spacer size="medium" />

      <Card>
        <CardHeader>
          <View>
            {/* Inspector info */}
          </View>
        </CardHeader>
        <CardBody>
          <TextInput
            label="Inspector Name"
            placeholder="Your name"
            value={inspectorName}
            onChangeText={setInspectorName}
          />

          <Spacer size="medium" />

          {/* Signature pad */}
          <View style={styles.signaturePad}>
            {signatureData ? (
              <View style={styles.signaturePreview}>
                {/* Signature preview */}
              </View>
            ) : (
              <View style={styles.signaturePlaceholder}>
                {/* Draw signature here */}
              </View>
            )}
          </View>

          <Spacer size="small" />

          <Button
            title={signatureData ? 'Clear Signature' : 'Sign Here'}
            onPress={handleClearSignature}
            variant="secondary"
          />

          <Spacer size="medium" />

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
        </CardBody>
      </Card>

      <Spacer size="large" />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  signaturePad: {
    height: 200,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 4,
    overflow: 'hidden',
  },
  signaturePlaceholder: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signaturePreview: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
  },
});
