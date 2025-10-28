import { redirect } from "next/navigation";

import InterviewCard from "@/components/InterviewCard";
import { getLatestInterviews } from "@/lib/actions/general.action";
import { getCurrentUser } from "@/lib/actions/auth.action";

const InterviewList = async () => {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const interviews = await getLatestInterviews({
    userId: user.id,
    limit: 10,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Practice Interviews</h1>
        <p className="text-muted-foreground">
          Choose from available interview sessions to practice your skills
        </p>
      </div>

      {interviews && interviews.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {interviews.map((interview) => (
            <InterviewCard
              key={interview.id}
              interviewId={interview.id}
              userId={user.id}
              role={interview.role}
              type={interview.type}
              techstack={interview.techstack}
              createdAt={interview.createdAt}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground mb-4">
            No interviews available at the moment.
          </p>
          <p className="text-sm text-muted-foreground">
            Create a new interview session to get started.
          </p>
        </div>
      )}
    </div>
  );
};

export default InterviewList;
