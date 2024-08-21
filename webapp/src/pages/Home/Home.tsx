import React, { useState, lazy, Suspense } from 'react';
import { Tabbar } from '@telegram-apps/telegram-ui';
import styles from '@/pages/Home/Home.module.css';

// Lazy load page components
const DateSelection = lazy(() => import('@/pages/DateSelection/DateSelection'));
const Calendar = lazy(() => import('@/pages/Invite/Invite'));
const Settings = lazy(() => import('@/pages/Search/Search'));

// Define tabs configuration
const tabConfig = [
	{ id: 'dates', icon: '📅', component: DateSelection },
	{ id: 'calendar', icon: '🗓️', component: Calendar },
	{ id: 'settings', icon: '⚙️', component: Settings },
];

const Home: React.FC<{ token: string }> = ({ token }) => {
	const [currentTab, setCurrentTab] = useState(tabConfig[0].id);

	const ActiveComponent =
		tabConfig.find(tab => tab.id === currentTab)?.component || tabConfig[0].component;

	return (
		<div className={styles.container}>
			<Suspense fallback={<div>Loading...</div>}>
				<ActiveComponent token={token} />
			</Suspense>

			<Tabbar className={styles.tabbar}>
				{tabConfig.map(({ id, icon }) => (
					<Tabbar.Item
						key={id}
						text={id.charAt(0).toUpperCase() + id.slice(1)}
						selected={id === currentTab}
						onClick={() => setCurrentTab(id)}
					>
						<div style={{ width: 28, height: 28 }}>{icon}</div>
					</Tabbar.Item>
				))}
			</Tabbar>
		</div>
	);
};

export default Home;
