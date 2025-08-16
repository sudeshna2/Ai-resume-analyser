import React, {type FormEvent, useState} from "react";
import {Form, useNavigate, useParams} from "react-router";
import Navbar from "~/components/Navbar";
import FileUploader from "~/components/fileuploader";
import {usePuterStore} from "~/lib/puter";
import {convertPdfToImage} from "~/lib/pdf2img";
import {generateUUID} from "~/lib/utils";
import * as path from "node:path";
import {prepareInstructions} from "~/constants";

const Upload = () =>{
    const {auth, isLoading ,fs ,ai,kv} = usePuterStore();
    const navigate = useNavigate();

    const [isProcessing, setIsProcessing] = useState(false);
    const [statusText,setStatusText] = useState("")
    const [file ,setFile] = useState<File | null>(null)
    const handleFileSelect = (file : File | null) => {
        setFile(file)
    }

    const handleAnalyze = async ({ companyName, jobTitle, jobDescription, file }: { companyName: string, jobTitle: string, jobDescription: string, file: File  }) => {
        setIsProcessing(true);
        setStatusText('Uploading file...');

        const uploadedFile = await fs.upload([file]);
        if (!uploadedFile) return setStatusText('Error:Failed to upload');
        setStatusText('converting into image');

        const imageFile = await convertPdfToImage(file);
        if (!imageFile.file) return setStatusText('Error:Failed to convert image');
        setStatusText('uploading the image');

        const uploadedImage = await fs.upload(imageFile.file);
        if (!uploadedImage) return setStatusText('Error:Failed to upload image');
        setStatusText('processing the data...');

        const uuid =generateUUID();
        const data = {
            id: uuid,
            resumePath: uploadedFile.path,
            imagePath: uploadedImage.path,
            companyName,jobTitle,jobDescription,
            feedback:''
        }
        await kv.set(`resume:${uuid}`,JSON.stringify(data));
        setStatusText('Analyzing...');

        const feedback = await ai.feedback(
            uploadedFile.path,
            prepareInstructions({jobTitle,jobDescription})
        )

        if (!feedback) return setStatusText('Error:Failed to analyze');
        const feedbackText = typeof feedback.message.content === 'string' ? feedback.message.content : feedback.message.content[0].text;

        data.feedback = JSON.parse(feedbackText);
        await kv.set(`resume:${uuid}`,JSON.stringify(data));
        setStatusText('Analysis completed.Redirecting..');
        console.log(data)
    }

    const handlesubmit =(e:FormEvent<HTMLFormElement>)=>{
        e.preventDefault();
        const form = e.currentTarget.closest('form')
        if (!form) return;
        const formData = new FormData(form)

        const companyName = formData.get('company-name') as string;
        const jobTitle = formData.get('Job-Title') as string;
        const jobDescription = formData.get('Job-description') as string;

        if (!file) return;
        handleAnalyze({companyName,jobTitle,jobDescription,file});
    }
    return (
        <main className="bg-[url('/images/bg-main.svg')] bg-cover">
            <Navbar />
            <section className="main-section">
                <div className="page-heading py-12">
                    <h1>Smart feedback for your dream job</h1>
                    {isProcessing ? (
                        <>
                            <h2>{statusText}</h2>
                            <img src='/images/resume-scan.gif' className="w-full"/>
                        </>
                    ):(
                        <h2>Drop your resume for ATS Score</h2>
                    )}
                    {!isProcessing && (
                        <Form id="upload-form" onSubmit={handlesubmit} className="flex flex-col gap-4 mt-5">
                            <div className='form-div'>
                                <label htmlFor="company-name">Company Name</label>
                                <input type={'text'} name='company-name' placeholder='Company Name' id={'company-name'}/>
                            </div>
                            <div className='form-div'>
                                <label htmlFor="Job-Title">Job Title</label>
                                <input type={'text'} name='Job-Title' placeholder='Job Title' id={'Job-Title'}/>
                            </div>
                            <div className='form-div'>
                                <label htmlFor="Job-description">Job description</label>
                                <textarea rows={5} name='Job-description' placeholder='Job description' id={'Job-description'}/>
                            </div>
                            <div className='form-div'>
                                <label htmlFor="uploader">Upload Resume</label>
                                <FileUploader onFileSelect={handleFileSelect}/>
                            </div>
                            <button type='submit' className="primary-button">Analyse your Resume</button>
                        </Form>
                    )
                    }
                </div>
            </section>
        </main>

    )
}

export default Upload;