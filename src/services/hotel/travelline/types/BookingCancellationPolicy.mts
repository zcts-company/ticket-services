export type BookingCancellationPolicy = {
    freeCancellationPossible: boolean,
    freeCancellationDeadlineLocal: string,
    freeCancellationDeadlineUtc: string,
    penaltyAmount: number
}