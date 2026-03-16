import { AppShell } from "../../components/app-shell"
import { SalesDataManager } from "../../components/sales-data-manager"

type RecordsPageProps = {
    searchParams: Promise<{
        region?: string
        salesManager?: string
        vendor?: string
    }>
}

export default async function RecordsPage({ searchParams }: RecordsPageProps) {
    const params = await searchParams

    return (
        <AppShell
            activeItem="records"
            eyebrow="Sales Data"
            title="Sales record workspace"
            description="Filter, create, edit, and delete imported sales rows while keeping region, manager, and vendor master data in sync."
        >
            <SalesDataManager
                initialFilters={{
                    region: params.region ?? "",
                    salesManager: params.salesManager ?? "",
                    vendor: params.vendor ?? "",
                }}
            />
        </AppShell>
    )
}
