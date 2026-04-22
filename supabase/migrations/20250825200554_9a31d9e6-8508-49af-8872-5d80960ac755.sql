-- Create enum for submission types
CREATE TYPE submission_type AS ENUM ('solo', 'coautoria');

-- Create enum for submission status
CREATE TYPE submission_status AS ENUM ('novo', 'recebido', 'em_analise', 'solicitar_ajustes', 'concluido');

-- Create enum for user types
CREATE TYPE user_type AS ENUM ('admin', 'editor', 'logistica', 'member');

-- Create profiles table for additional user information
CREATE TABLE public.profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    user_type user_type NOT NULL DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chapter_submissions table
CREATE TABLE public.chapter_submissions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    author_name TEXT NOT NULL,
    author_email TEXT NOT NULL,
    submission_type submission_type NOT NULL,
    chapter_title TEXT,
    chapter_content TEXT NOT NULL,
    curriculum TEXT NOT NULL,
    summary TEXT NOT NULL,
    cover_text TEXT,
    photo_file_url TEXT,
    status submission_status NOT NULL DEFAULT 'novo',
    comments TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapter_submissions ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create policies for chapter_submissions
CREATE POLICY "Anyone can insert submissions" 
ON public.chapter_submissions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can view all submissions" 
ON public.chapter_submissions 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update submissions" 
ON public.chapter_submissions 
FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete submissions" 
ON public.chapter_submissions 
FOR DELETE 
USING (auth.role() = 'authenticated');

-- Create function to get user type
CREATE OR REPLACE FUNCTION public.get_user_type(user_uuid uuid)
RETURNS user_type
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT user_type FROM public.profiles WHERE user_id = user_uuid;
$function$;

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
    INSERT INTO public.profiles (user_id, full_name, email, user_type)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Novo Usuário'),
        NEW.email,
        'user'
    );
    RETURN NEW;
END;
$function$;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_submissions_updated_at
    BEFORE UPDATE ON public.chapter_submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for photo uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('chapter-photos', 'chapter-photos', true);

-- Create storage policies
CREATE POLICY "Anyone can upload photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'chapter-photos');

CREATE POLICY "Photos are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'chapter-photos');