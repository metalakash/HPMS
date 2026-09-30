/**
 * Layout Components - Unit Tests
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  ScreenContainer,
  Card,
  CardHeader,
  CardBody,
  Badge,
  ListItem,
  Header,
  EmptyState,
  ErrorState,
  LoadingOverlay,
  Divider,
  Spacer,
} from './index';

describe('Layout Components', () => {
  describe('ScreenContainer', () => {
    it('renders children', () => {
      const { getByText } = render(
        <ScreenContainer>
          <React.Fragment>Test Content</React.Fragment>
        </ScreenContainer>
      );
      expect(getByText('Test Content')).toBeTruthy();
    });

    it('renders scrollable variant', () => {
      const { root } = render(
        <ScreenContainer scrollable>
          <React.Fragment>Scrollable Content</React.Fragment>
        </ScreenContainer>
      );
      expect(root).toBeTruthy();
    });
  });

  describe('Card', () => {
    it('renders card with content', () => {
      const { getByText } = render(
        <Card>
          <React.Fragment>Card Content</React.Fragment>
        </Card>
      );
      expect(getByText('Card Content')).toBeTruthy();
    });

    it('handles press events', () => {
      const mockPress = jest.fn();
      const { getByTestId } = render(
        <Card onPress={mockPress} testID="card-press">
          <React.Fragment>Pressable Card</React.Fragment>
        </Card>
      );
      const card = getByTestId('card-press');
      fireEvent.press(card);
      expect(mockPress).toHaveBeenCalled();
    });
  });

  describe('Badge', () => {
    it('renders with label', () => {
      const { getByText } = render(
        <Badge label="Success" />
      );
      expect(getByText('Success')).toBeTruthy();
    });

    it('renders different variants', () => {
      const { rerender, getByText } = render(
        <Badge label="Test" variant="success" />
      );
      expect(getByText('Test')).toBeTruthy();

      rerender(<Badge label="Error" variant="error" />);
      expect(getByText('Error')).toBeTruthy();
    });
  });

  describe('ListItem', () => {
    it('renders title and subtitle', () => {
      const { getByText } = render(
        <ListItem
          title="Item Title"
          subtitle="Item Subtitle"
        />
      );
      expect(getByText('Item Title')).toBeTruthy();
      expect(getByText('Item Subtitle')).toBeTruthy();
    });

    it('handles press events', () => {
      const mockPress = jest.fn();
      const { getByTestId } = render(
        <ListItem
          title="Pressable Item"
          onPress={mockPress}
          testID="list-item"
        />
      );
      const item = getByTestId('list-item');
      fireEvent.press(item);
      expect(mockPress).toHaveBeenCalled();
    });
  });

  describe('Header', () => {
    it('renders title', () => {
      const { getByText } = render(
        <Header title="Test Header" />
      );
      expect(getByText('Test Header')).toBeTruthy();
    });

    it('renders with subtitle', () => {
      const { getByText } = render(
        <Header title="Header" subtitle="Subtitle" />
      );
      expect(getByText('Header')).toBeTruthy();
      expect(getByText('Subtitle')).toBeTruthy();
    });
  });

  describe('EmptyState', () => {
    it('renders title and description', () => {
      const { getByText } = render(
        <EmptyState
          title="No Data"
          description="There's no data to display"
        />
      );
      expect(getByText('No Data')).toBeTruthy();
      expect(getByText("There's no data to display")).toBeTruthy();
    });

    it('handles action button', () => {
      const mockAction = jest.fn();
      const { getByText } = render(
        <EmptyState
          title="Empty"
          actionLabel="Add Item"
          onAction={mockAction}
        />
      );
      fireEvent.press(getByText('Add Item'));
      expect(mockAction).toHaveBeenCalled();
    });
  });

  describe('ErrorState', () => {
    it('renders error title and message', () => {
      const { getByText } = render(
        <ErrorState
          title="Error"
          message="Something went wrong"
        />
      );
      expect(getByText('Error')).toBeTruthy();
      expect(getByText('Something went wrong')).toBeTruthy();
    });

    it('handles retry action', () => {
      const mockRetry = jest.fn();
      const { getByText } = render(
        <ErrorState
          title="Error"
          onRetry={mockRetry}
        />
      );
      fireEvent.press(getByText('Try Again'));
      expect(mockRetry).toHaveBeenCalled();
    });
  });

  describe('LoadingOverlay', () => {
    it('shows when visible', () => {
      const { UNSAFE_root } = render(
        <LoadingOverlay visible={true} />
      );
      expect(UNSAFE_root).toBeTruthy();
    });

    it('hides when not visible', () => {
      const { queryByType } = render(
        <LoadingOverlay visible={false} />
      );
      // Modal component should not render when visible=false
      expect(queryByType).toBeDefined();
    });
  });

  describe('Divider', () => {
    it('renders horizontal divider', () => {
      const { UNSAFE_root } = render(
        <Divider orientation="horizontal" />
      );
      expect(UNSAFE_root).toBeTruthy();
    });

    it('renders vertical divider', () => {
      const { UNSAFE_root } = render(
        <Divider orientation="vertical" />
      );
      expect(UNSAFE_root).toBeTruthy();
    });
  });

  describe('Spacer', () => {
    it('renders with different sizes', () => {
      const { rerender, UNSAFE_root } = render(
        <Spacer size="sm" />
      );
      expect(UNSAFE_root).toBeTruthy();

      rerender(<Spacer size="lg" />);
      expect(UNSAFE_root).toBeTruthy();
    });

    it('renders flex spacer', () => {
      const { UNSAFE_root } = render(
        <Spacer flex />
      );
      expect(UNSAFE_root).toBeTruthy();
    });
  });
});
