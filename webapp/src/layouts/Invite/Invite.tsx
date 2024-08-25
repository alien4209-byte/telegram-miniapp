import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import { useMiniApp, useMainButton, initPopup, initHapticFeedback } from '@telegram-apps/sdk-react';
import { useMutation } from '@tanstack/react-query';
import { Text } from '@telegram-apps/telegram-ui';
import { sendDates } from '@/services/api';

import 'react-day-picker/dist/style.css';
import styles from '@/layouts/Invite/Invite.module.css';

const formatDate = (date: Date) => format(date, 'yyyy-MM-dd');

const Invite: React.FC<HomeProps> = ({ token }) => {
	const miniapp = useMiniApp();
	const mainButton = useMainButton();
	const popup = initPopup();
	const hapticFeedback = initHapticFeedback();
	const [selectedDates, setSelectedDates] = useState<Date[]>([]);

	const dateMutation = useMutation({
		mutationKey: ['sendDate', token],
		mutationFn: (dates: Date[]) => sendDates(token, dates.map(formatDate)),
		onSuccess: () => miniapp.close(true),
		onError: error => {
			popup
				.open({
					title: 'Error',
					message: `${error instanceof Error ? error.message : 'An error occurred'}. Please try again.`,
					buttons: [
						{ id: 'ok', type: 'default', text: 'OK' },
						{ id: 'retry', type: 'default', text: 'Retry' },
					],
				})
				.then((buttonId: string | null) => {
					if (buttonId === 'retry') dateMutation.mutate(selectedDates);
				});
		},
	});

	const handleMainButtonClick = useCallback(() => {
		if (selectedDates.length > 0) {
			hapticFeedback.impactOccurred('medium');
			dateMutation.mutate(selectedDates);
		}
	}, [selectedDates, dateMutation, hapticFeedback]);

	useEffect(() => {
		miniapp.ready();

		if (selectedDates.length > 0) {
			mainButton.setText('Select dates').show();
			mainButton[dateMutation.isLoading ? 'showLoader' : 'hideLoader']();
			mainButton[dateMutation.isLoading ? 'disable' : 'enable']();
			mainButton.on('click', handleMainButtonClick);
		} else {
			mainButton.hide();
		}

		return () => {
			mainButton.off('click', handleMainButtonClick);
		};
	}, [miniapp, selectedDates, dateMutation.isLoading, mainButton, handleMainButtonClick]);

	const footer = useMemo(() => {
		if (selectedDates.length === 0) {
			return <Text>Please pick the days you propose for the meetup.</Text>;
		}
		const dateString = selectedDates.map(date => format(date, 'PP')).join(', ');
		return (
			<Text>
				You picked {selectedDates.length} {selectedDates.length > 1 ? 'dates' : 'date'}:{' '}
				{dateString}
			</Text>
		);
	}, [selectedDates]);

	return (
		<div className={styles.container}>
			<h2 className={styles.title}>Pick proposed dates</h2>
			<DayPicker
				mode="multiple"
				weekStartsOn={1}
				min={1}
				max={5}
				selected={selectedDates}
				onSelect={days => setSelectedDates(days!)}
				footer={footer}
				disabled={dateMutation.isLoading}
			/>
		</div>
	);
};

export default Invite;
