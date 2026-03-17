/* Module: Catalog entity metadata used by UI routing and labels for master data screens. */
export const catalogConfig = {
    regions: {
        title: "Regions",
        singular: "region",
        field: "region",
        activeItem: "regions",
    },
    "sales-managers": {
        title: "Sales Manager Plans",
        singular: "sales manager plan",
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

