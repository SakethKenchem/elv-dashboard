export const catalogConfig = {
    regions: {
        title: "Regions",
        singular: "region",
        field: "region",
        activeItem: "regions",
    },
    "sales-managers": {
        title: "Sales Managers",
        singular: "sales manager",
        field: "salesManager",
        activeItem: "sales-managers",
    },
    vendors: {
        title: "Vendors",
        singular: "vendor",
        field: "vendor",
        activeItem: "vendors",
    },
} as const

export type CatalogEntity = keyof typeof catalogConfig

export function isCatalogEntity(value: string): value is CatalogEntity {
    return value in catalogConfig
}
