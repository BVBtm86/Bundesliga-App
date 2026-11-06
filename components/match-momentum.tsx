import { useI18n } from "@/lib/i18n";
type MatchMomentumProps = {
  homeName: string;
  awayName: string;
};

export default function MatchMomentum({homeName, awayName}: MatchMomentumProps) {
  const {t}=useI18n();
  const labels = ["0'", "15'", "30'", "HT", "60'", "75'", "90'"];
  return <section className="match-momentum unavailable" aria-label={t("report.matchMomentum")}>
    <div className="match-momentum-heading">
      <div className="momentum-legend"><span className="momentum-home">{homeName}</span><span className="momentum-away">{awayName}</span></div>
    </div>
    <div className="momentum-placeholder-chart">
      <svg viewBox="0 0 720 180" role="img" aria-label={t("report.matchMomentumComingSoon")}>
        {[35, 70, 105, 140].map(y=><line key={y} x1="18" x2="702" y1={y} y2={y} className="momentum-gridline" />)}
        <line x1="18" x2="702" y1="88" y2="88" className="momentum-baseline" />
        {labels.map((label,index)=><text key={label} x={18+index*684/(labels.length-1)} y="169" textAnchor="middle" className="momentum-axis-label">{label}</text>)}
      </svg>
      <div className="momentum-placeholder-copy"><strong>{t("report.matchMomentum")}</strong><span>{t("report.attackingPressureComingSoon")}</span></div>
    </div>
  </section>;
}
