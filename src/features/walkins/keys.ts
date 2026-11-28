/** Query keys for the doctor queue. The first element of the board key is the prefix the realtime provider invalidates. */
export const walkinKeys = {
  board: (clinicLocationId: string, doctorId: string) => ['walkin-board', clinicLocationId, doctorId] as const,
  consultation: (id: string) => ['consultation', id] as const,
};
