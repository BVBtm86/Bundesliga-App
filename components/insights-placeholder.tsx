import { Sparkles } from "lucide-react";

type Props = {
  title?: string;
  description: string;
  insightType?: string;
  integrationId?: string;
};

export default function InsightsPlaceholder({title="Insights",description,insightType,integrationId}:Props) {
  return <section className="insights-placeholder" data-insight-type={insightType} data-integration-id={integrationId} aria-label={title}>
    <Sparkles size={15} aria-hidden="true" />
    <div><strong>{title}</strong><span>Coming later</span><p>{description}</p></div>
  </section>;
}
