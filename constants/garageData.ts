export interface GarageCapacity {
    stationName: string;
    stationId: string;
    units4Car: number;
    units3Car: number;
    totalUnitsStartService: number;
    capacityDuringService: number;
}

export const GARAGE_PLAN: GarageCapacity[] = [
    {
        stationName: "Plaça Catalunya",
        stationId: "PC",
        units4Car: 4,
        units3Car: 1,
        totalUnitsStartService: 5,
        capacityDuringService: 2
    },
    {
        stationName: "Reina Elisenda",
        stationId: "RE",
        units4Car: 3,
        units3Car: 3,
        totalUnitsStartService: 6,
        capacityDuringService: 5
    },
    {
        stationName: "COR Rubi",
        stationId: "RB",
        units4Car: 22,
        units3Car: 1,
        totalUnitsStartService: 23,
        capacityDuringService: 24
    },
    {
        stationName: "Terrassa Nacions Unides",
        stationId: "NA",
        units4Car: 15,
        units3Car: 0,
        totalUnitsStartService: 15,
        capacityDuringService: 11
    },
    {
        stationName: "Sabadell Parc del Nord",
        stationId: "PN",
        units4Car: 12,
        units3Car: 0,
        totalUnitsStartService: 12,
        capacityDuringService: 9
    }
];

export const TOTAL_FLEET = {
    units4Car: 56,
    units3Car: 5,
    total: 61,
    totalCapacityDuringService: 51
};
