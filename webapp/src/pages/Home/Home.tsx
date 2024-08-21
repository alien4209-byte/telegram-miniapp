import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Tabbar } from '@telegram-apps/telegram-ui';
import { useMainButton, useBackButton, useMiniApp } from '@telegram-apps/sdk-react';
import styles from '@/pages/Home/Home.module.css';

const DateSelection = lazy(() => import('@/pages/DateSelection/DateSelection'));
const Invite = lazy(() => import('@/pages/Invite/Invite'));
const Search = lazy(() => import('@/pages/Search/Search'));

const tabConfig = [
	{ id: 'calendar', icon: '📅', component: DateSelection },
	{ id: 'invite', icon: '🗓️', component: Invite },
	{ id: 'settings', icon: '⚙️', component: Search },
];

const Home: React.FC<{ token: string }> = ({ token }) => {
	const [currentTab, setCurrentTab] = useState(tabConfig[0].id);
	const mainButton = useMainButton();
	const backButton = useBackButton();
	const miniApp = useMiniApp();

	const ActiveComponent =
		tabConfig.find(tab => tab.id === currentTab)?.component || tabConfig[0].component;

	useEffect(() => {
		miniApp.ready();
		backButton.show();

		return () => {
			backButton.hide();
		};
	}, [miniApp, backButton]);

	const handleTabChange = (id: string) => {
		setCurrentTab(id);
		mainButton.hide();
	};

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
						onClick={() => handleTabChange(id)}
					>
						<div style={{ width: 28, height: 28 }}>{icon}</div>
					</Tabbar.Item>
				))}
			</Tabbar>
		</div>
	);
};

export default Home;
