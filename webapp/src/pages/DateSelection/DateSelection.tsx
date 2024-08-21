import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import { useMiniApp, useMainButton, initPopup, initHapticFeedback } from '@telegram-apps/sdk-react';
import { useMutation } from '@tanstack/react-query';
import { Text } from '@telegram-apps/telegram-ui';
import { sendDates } from '@/api';
import { HomeProps } from '@/types/types';
import { useNavigate, useLocation } from 'react-router-dom';

import 'react-day-picker/dist/style.css';
import styles from '@/pages/DateSelection/DateSelection.module.css';

const formatDate = (date: Date) => format(date, 'yyyy-MM-dd');

const DateSelection: React.FC<HomeProps> = ({ token }) => {
	const miniapp = useMiniApp();
	const mainButton = useMainButton();
	const popup = initPopup();
	const hapticFeedback = initHapticFeedback();
	const navigate = useNavigate();
	const location = useLocation();
	const [selectedDates, setSelectedDates] = useState<Date[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const dateMutation = useMutation({
		mutationKey: ['sendDate', token],
		mutationFn: (dates: Date[]) => sendDates(token, dates.map(formatDate)),
		onSuccess: () => miniapp.close(true),
		onError: error => {
			setIsSubmitting(false);
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
					if (buttonId === 'retry') handleMainButtonClick();
				});
		},
	});

	const handleMainButtonClick = useCallback(() => {
		if (selectedDates.length > 0 && !isSubmitting) {
			hapticFeedback.impactOccurred('medium');
			setIsSubmitting(true);
			// Push a new state to handle back button for MainButton press
			navigate(location.pathname, { state: { isSubmitting: true } });
			dateMutation.mutate(selectedDates);
		}
	}, [selectedDates, dateMutation, hapticFeedback, isSubmitting, navigate, location.pathname]);

	useEffect(() => {
		miniapp.ready();

		if (selectedDates.length > 0) {
			mainButton.setText('Select dates').show();
			mainButton[isSubmitting ? 'showLoader' : 'hideLoader']();
			mainButton[isSubmitting ? 'disable' : 'enable']();
			mainButton.on('click', handleMainButtonClick);
		} else {
			mainButton.hide();
		}

		// Handle back navigation when isSubmitting
		if (location.state && (location.state as { isSubmitting: boolean }).isSubmitting) {
			setIsSubmitting(true);
		}

		return () => {
			mainButton.off('click', handleMainButtonClick);
		};
	}, [miniapp, selectedDates, isSubmitting, mainButton, handleMainButtonClick, location.state]);

	// Handle back navigation
	useEffect(() => {
		return () => {
			if (isSubmitting) {
				dateMutation.reset();
				setIsSubmitting(false);
			}
		};
	}, [isSubmitting, dateMutation]);

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
				disabled={isSubmitting}
			/>
		</div>
	);
};

export default DateSelection;
