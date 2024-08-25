import React from 'react';
import { FallbackProps } from 'react-error-boundary';
import { useLanguage } from '@/utils/LanguageContext';
import { Text, Button, Section } from '@telegram-apps/telegram-ui';

const ErrorFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
	const { t } = useLanguage();

	return (
		<Section
			style={{
				padding: '32px 16px',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				minHeight: '100vh',
			}}
		>
			<Text style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>
				{t('error.unexpected')}
			</Text>
			<Text
				style={{
					color: 'var(--tg-theme-text-color)',
					opacity: 0.7,
					marginBottom: '24px',
					textAlign: 'center',
					maxWidth: '280px',
				}}
			>
				{error.message}
			</Text>
			<Button
				onClick={resetErrorBoundary}
				style={{
					marginTop: '16px',
					minWidth: '120px',
					padding: '12px 24px',
					fontSize: '16px',
					backgroundColor: 'var(--tg-theme-button-color)',
					color: 'var(--tg-theme-button-text-color)',
					border: 'none',
					borderRadius: '8px',
					cursor: 'pointer',
					transition: 'opacity 0.2s ease',
				}}
			>
				{t('common.retry')}
			</Button>
		</Section>
	);
};

export default ErrorFallback;
