import dynamic from "next/dynamic";

const BloodBankManagementSystem = dynamic(() => import("@/components/BloodBankManagementSystem"), { ssr: false });

export default function Home() {
  return <BloodBankManagementSystem />;
}
