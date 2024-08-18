import React, { useEffect } from 'react';
import { DayPicker, SelectMultipleEventHandler } from 'react-day-picker';
import { useQuery } from '@tanstack/react-query';
import { Spinner, Text } from '@telegram-apps/telegram-ui';
import { getCalendarByRef } from '@/api';
import { CalendarProps, CalendarType } from '@/types/types';
import 'react-day-picker/dist/style.css';

const Calendar: React.FC<CalendarProps> = ({ token, apiRef }) => {
	const [selectedDates, setSelectedDates] = React.useState<Date[]>([]);
	const [availableDates, setAvailableDates] = React.useState<Date[]>([]);

	const { data, isLoading, error } = useQuery<{ calendar: CalendarType }, Error>({
		queryKey: ['calendar', apiRef],
		queryFn: () => getCalendarByRef(token, apiRef),
	});

	useEffect(() => {
		if (data && data.calendar && Array.isArray(data.calendar.dates)) {
			console.log('API Response:', data);
			const parsedDates = data.calendar.dates.map(dateStr => new Date(dateStr));
			setAvailableDates(parsedDates);
			console.log('Available Dates:', parsedDates);
		}
	}, [data]);

	const disabledDays = React.useCallback(
		(date: Date) => {
			return !availableDates.some(
				availableDate =>
					availableDate.toISOString().split('T')[0] === date.toISOString().split('T')[0]
			);
		},
		[availableDates]
	);

	const handleDaySelect: SelectMultipleEventHandler = dates => {
		setSelectedDates(dates || []);
	};

	if (isLoading) return <Spinner size="l" />;
	if (error) return <Text color="red">Error: {error.message}</Text>;

	return (
		<div>
			<h2>Pick out of proposed dates</h2>
			<DayPicker
				mode="multiple"
				selected={selectedDates}
				onSelect={handleDaySelect}
				disabled={disabledDays}
				footer={
					selectedDates.length > 0
						? `You picked ${selectedDates.length} date(s): ${selectedDates.map(date => date.toDateString()).join(', ')}`
						: 'Please pick one or more dates'
				}
			/>
			<div>
				<h3>Debug Information:</h3>
				<p>Available Dates: {availableDates.map(d => d.toDateString()).join(', ')}</p>
				<p>Selected Dates: {selectedDates.map(d => d.toDateString()).join(', ')}</p>
			</div>
		</div>
	);
};

export default Calendar;
