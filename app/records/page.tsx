/* Module: Sales Managers hub route that hosts the primary manager plan management experience. */
import { AppShell } from "../../components/app-shell"
import { SalesManagerCrud } from "@/components/sales-manager-crud"

type RecordsPageProps = {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function RecordsPage({ searchParams: _searchParams }: RecordsPageProps) {
    const params = await _searchParams
    const initialRegion = typeof params.region === "string" ? params.region : ""

    return (
        <AppShell
            activeItem="records"
            eyebrow="Sales Managers"
            title="Sales Manager Hub"
            description="One place for each sales manager plan, targets, commitments, achievements, and linked sales performance."
        >
            <SalesManagerCrud initialRegion={initialRegion} />
        </AppShell>
    )
}

