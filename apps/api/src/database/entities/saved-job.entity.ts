import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { CandidateProfile } from './candidate-profile.entity';
import { JobPosting } from './job-posting.entity';

@Entity({ name: 'saved_jobs' })
export class SavedJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'candidate_profile_id' })
  candidateProfileId: string;

  @ManyToOne(() => CandidateProfile, (profile) => profile.savedJobs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidate_profile_id' })
  candidateProfile: CandidateProfile;

  @Column({ name: 'job_posting_id' })
  jobPostingId: string;

  @ManyToOne(() => JobPosting, (jobPosting) => jobPosting.savedByCandidates, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_posting_id' })
  jobPosting: JobPosting;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
