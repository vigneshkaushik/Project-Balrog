import { useNavigate } from "react-router-dom";
import { useToast } from "../../context/ToastContext";
import { useApp } from "../../context/useApp";
import { clashReportGateMessage } from "../../lib/clashReportGateMessage";
import { FileUpload } from "./FileUpload";
import { SpeckleUrlInput } from "./SpeckleUrlInput";

const isDebuggingMode = import.meta.env.DEV;

export function LandingPage() {
	const navigate = useNavigate();
	const { showToast } = useToast();
	const {
		setNavisworksReport,
		navisworksFileName,
		speckleUrls,
		startClashUpload,
	} = useApp();

	const hasSpeckleUrl = speckleUrls.some((u) => u.trim().length > 0);
	const hasClashReport = Boolean(navisworksFileName);

	const canContinue = hasClashReport && hasSpeckleUrl;
	const buttonDisabled = !isDebuggingMode && !canContinue;

	const handleGo = () => {
		if (!hasSpeckleUrl || !hasClashReport) {
			showToast("error", clashReportGateMessage(hasSpeckleUrl, hasClashReport));
			return;
		}
		startClashUpload();
		navigate("/inspector");
	};

	return (
		<div className="flex min-h-full flex-1 items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-lg rounded-2xl border border-neutral-200/80 bg-white p-8 shadow-md shadow-neutral-900/5">
				<h1 className="text-center text-xl font-bold text-neutral-900 md:text-2xl">
					Get started in 3 simple steps
				</h1>

				<ol className="mt-6 list-decimal space-y-3 pl-5 text-left text-sm text-neutral-700 md:text-base">
					<li>Upload your clash report from Navisworks</li>
					<li>Add the relevant speckle model URLs</li>
					<li>Inspect your clashes, generate analyses and recommendations!</li>
				</ol>

				<div className="mt-8 flex flex-col gap-3">
					<FileUpload onFileSelected={setNavisworksReport} />

					{navisworksFileName && (
						<p className="text-center text-xs text-neutral-500">
							Selected:{" "}
							<span className="font-medium text-neutral-700">
								{navisworksFileName}
							</span>
						</p>
					)}

					<SpeckleUrlInput />
				</div>

				<button
					type="button"
					disabled={buttonDisabled}
					title={
						buttonDisabled
							? "Upload a Navisworks clash report and add at least one Speckle URL"
							: isDebuggingMode && !canContinue
								? "Debug: enabled for local testing"
								: undefined
					}
					onClick={handleGo}
					className="btn-primary btn-primary--full mt-6"
				>
					Go to clash report
				</button>
			</div>
		</div>
	);
}
