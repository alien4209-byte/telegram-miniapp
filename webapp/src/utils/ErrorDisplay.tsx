import React from 'react';
import { Text, Button } from '@telegram-apps/telegram-ui';
import { useLanguage } from '@/utils/LanguageContext';

interface ErrorDisplayProps {
  message: string;
  onRetry?: () => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ message, onRetry }) => {
  const { t } = useLanguage();

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <Text>{t(message)}</Text>
      {onRetry && (
        <Button onClick={onRetry} style={{ marginTop: '10px' }}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
};

export default ErrorDisplay;
