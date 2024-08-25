import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import App from '@/App';
import '@/index.css';
import { SDKProvider } from '@telegram-apps/sdk-react';
import ErrorFallback from '@/utils/ErrorFallback';

const rootElement = document.getElementById('root');
if (!rootElement) {
	throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
	<React.StrictMode>
		<ErrorBoundary FallbackComponent={ErrorFallback}>
			<SDKProvider acceptCustomStyles debug>
				<App />
			</SDKProvider>
		</ErrorBoundary>
	</React.StrictMode>
);
