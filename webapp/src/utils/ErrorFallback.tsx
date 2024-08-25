import React from 'react';
import { FallbackProps } from 'react-error-boundary';
import { useLanguage } from '@/utils/LanguageContext';
import { Text, Button } from '@telegram-apps/telegram-ui';

const ErrorFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
	const { t } = useLanguage();

	return (
		<div role="alert" style={{ textAlign: 'center', padding: '20px' }}>
			<Text>{t('error.unexpected')}</Text>
			<Text style={{ color: 'red', margin: '10px 0' }}>{error.message}</Text>
			<Button onClick={resetErrorBoundary} style={{ marginTop: '10px' }}>
				{t('common.retry')}
			</Button>
		</div>
	);
};

export default ErrorFallback;
