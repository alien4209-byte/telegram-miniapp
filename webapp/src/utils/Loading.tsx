import React from 'react';
import { Spinner } from '@telegram-apps/telegram-ui';

const Loading: React.FC = () => (
	<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
		<Spinner size="l" />
	</div>
);

export default Loading;
