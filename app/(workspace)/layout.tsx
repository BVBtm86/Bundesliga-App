import { Suspense } from "react";
import Dashboard from "@/components/dashboard";
export default function WorkspaceLayout({children}:{children:React.ReactNode}) { return <><Suspense><Dashboard/></Suspense>{children}</>; }
